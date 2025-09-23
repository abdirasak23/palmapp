// PayFlow Notification & Payment System
// This script handles displaying payment notifications in the mobile app UI
// and processes payments with database updates

// Initialize Supabase client (same as your existing setup)
const supabaseUrl = 'https://gfqzzamwcewcoihbwuwm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmcXp6YW13Y2V3Y29paGJ3dXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjQ4MjQsImV4cCI6MjA3NDEwMDgyNH0.WcoOzI08tcIcwl4gtyPY2AWjw74e23ijkLcTTqiSYCM';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Configuration
const NOTIFICATION_CONFIG = {
    checkInterval: 5000, // Check for new notifications every 5 seconds
    maxNotifications: 5, // Maximum notifications to show at once
    autoHideDelay: 10000, // Auto-hide notifications after 10 seconds (0 = don't auto-hide)
    userId: '588e0e8d-01a8-4e7f-9575-c10b22efc990', // Current user ID
    soundEnabled: true
};

// Global variables
let notificationInterval = null;
let activeNotifications = new Map();
let isProcessingPayment = false;

// Initialize the notification system
function initializeNotificationSystem() {
    console.log('Initializing PayFlow Notification System...');
    
    // Create notification container if it doesn't exist
    createNotificationContainer();
    
    // Start monitoring for new payment requests
    startNotificationMonitoring();
    
    // Add notification sound
    preloadNotificationSound();
    
    // Update notification badge
    updateNotificationBadge();
    
    console.log('Notification system initialized successfully');
}

// Create the notification container in the app
function createNotificationContainer() {
    // Remove existing container if present
    const existingContainer = document.getElementById('payflow-notifications');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    const container = document.createElement('div');
    container.id = 'payflow-notifications';
    container.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10000;
        width: 350px;
        max-width: calc(100vw - 40px);
        pointer-events: none;
    `;
    
    document.body.appendChild(container);
}

// Start monitoring for payment notifications
function startNotificationMonitoring() {
    // Clear any existing interval
    if (notificationInterval) {
        clearInterval(notificationInterval);
    }
    
    // Initial check
    checkForPendingPayments();
    
    // Set up periodic checking
    notificationInterval = setInterval(() => {
        checkForPendingPayments();
    }, NOTIFICATION_CONFIG.checkInterval);
    
    console.log('Started monitoring for payment notifications');
}

// Check database for pending payments
async function checkForPendingPayments() {
    try {
        const { data, error } = await supabase
            .from('paid_table')
            .select('*')
            .eq('is_paid', false)
            .eq('status', 'pending')
            .eq('notification_sent', false)
            .order('timestamp', { ascending: false });

        if (error) {
            console.error('Error checking for pending payments:', error);
            return;
        }

        if (data && data.length > 0) {
            console.log(`Found ${data.length} new payment notifications`);
            
            // Process each pending payment
            for (const payment of data) {
                await showPaymentNotification(payment);
                
                // Mark notification as sent to avoid duplicates
                await markNotificationSent(payment.transaction_id);
            }
            
            // Update notification badge
            updateNotificationBadge();
        }
    } catch (error) {
        console.error('Error in checkForPendingPayments:', error);
    }
}

// Display payment notification in the app UI
async function showPaymentNotification(paymentData) {
    const notificationId = `notification-${paymentData.transaction_id}`;
    
    // Don't show duplicate notifications
    if (activeNotifications.has(notificationId)) {
        return;
    }
    
    // Play notification sound
    if (NOTIFICATION_CONFIG.soundEnabled) {
        playNotificationSound();
    }
    
    // Create notification element
    const notification = createNotificationElement(paymentData);
    
    // Add to container
    const container = document.getElementById('payflow-notifications');
    container.appendChild(notification);
    
    // Store reference
    activeNotifications.set(notificationId, {
        element: notification,
        paymentData: paymentData,
        timestamp: Date.now()
    });
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto-hide if configured
    if (NOTIFICATION_CONFIG.autoHideDelay > 0) {
        setTimeout(() => {
            hideNotification(notificationId);
        }, NOTIFICATION_CONFIG.autoHideDelay);
    }
    
    console.log(`Displayed notification for transaction: ${paymentData.transaction_id}`);
}

// Create notification DOM element
function createNotificationElement(paymentData) {
    const notification = document.createElement('div');
    notification.className = 'payflow-notification';
    notification.id = `notification-${paymentData.transaction_id}`;
    
    const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(paymentData.amount);
    
    const timeAgo = getTimeAgo(paymentData.timestamp);
    
    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-icon">
                <i class="fas fa-money-bill-wave"></i>
            </div>
            <div class="notification-title">Payment Request</div>
            <button class="notification-close" onclick="hideNotification('notification-${paymentData.transaction_id}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="notification-content">
            <div class="payment-details">
                <div class="payment-amount">${formattedAmount}</div>
                <div class="payment-description">${paymentData.product_name || 'Payment Request'}</div>
                <div class="payment-from">From: ${paymentData.user_name}</div>
                <div class="payment-time">${timeAgo}</div>
                <div class="transaction-id">ID: ${paymentData.transaction_id}</div>
            </div>
            <div class="notification-actions">
                <button class="btn-decline" onclick="declinePayment('${paymentData.transaction_id}')">
                    Decline
                </button>
                <button class="btn-pay" onclick="processPayment('${paymentData.transaction_id}')">
                    Pay Now
                </button>
            </div>
        </div>
        <div class="payment-progress" style="display: none;">
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-text">Processing payment...</div>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        margin-bottom: 16px;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: auto;
        border-left: 4px solid #667eea;
        overflow: hidden;
        backdrop-filter: blur(10px);
        position: relative;
    `;
    
    return notification;
}

// Process payment when user clicks "Pay Now"
async function processPayment(transactionId) {
    if (isProcessingPayment) {
        showToast('Another payment is being processed. Please wait...', 'warning');
        return;
    }
    
    isProcessingPayment = true;
    const notificationId = `notification-${transactionId}`;
    const notificationData = activeNotifications.get(notificationId);
    
    if (!notificationData) {
        console.error('Notification data not found for transaction:', transactionId);
        isProcessingPayment = false;
        return;
    }
    
    const notification = notificationData.element;
    const paymentData = notificationData.paymentData;
    
    try {
        // Show processing state
        showPaymentProgress(notification, 'Authorizing payment...');
        
        // Simulate payment authorization (replace with actual payment processing)
        await simulatePaymentAuthorization();
        
        // Update progress
        showPaymentProgress(notification, 'Processing payment...');
        
        // Update database to mark payment as completed
        const { data, error } = await supabase
            .from('paid_table')
            .update({
                is_paid: true,
                status: 'completed',
                payment_completed_at: new Date().toISOString(),
                payment_method: 'mobile_app'
            })
            .eq('transaction_id', transactionId)
            .select();
        
        if (error) {
            throw new Error(`Database update failed: ${error.message}`);
        }
        
        // Show success state
        showPaymentSuccess(notification, paymentData);
        
        // Update app balance (simulate)
        updateAppBalance(-paymentData.amount);
        
        // Hide notification after success animation
        setTimeout(() => {
            hideNotification(notificationId);
        }, 3000);
        
        // Show success toast
        const formattedAmount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(paymentData.amount);
        
        showToast(`Payment of ${formattedAmount} completed successfully!`, 'success');
        
        // Update notification badge
        updateNotificationBadge();
        
        console.log(`Payment completed successfully: ${transactionId}`);
        
    } catch (error) {
        console.error('Payment processing error:', error);
        showPaymentError(notification, error.message);
        showToast('Payment failed. Please try again.', 'error');
        
        // Reset notification after error
        setTimeout(() => {
            resetNotificationState(notification);
        }, 3000);
    } finally {
        isProcessingPayment = false;
    }
}

// Show payment progress animation
function showPaymentProgress(notification, message) {
    const content = notification.querySelector('.notification-content');
    const progress = notification.querySelector('.payment-progress');
    const progressText = notification.querySelector('.progress-text');
    
    content.style.display = 'none';
    progress.style.display = 'block';
    progressText.textContent = message;
    
    // Animate progress bar
    const progressFill = notification.querySelector('.progress-fill');
    progressFill.style.width = '0%';
    
    let width = 0;
    const interval = setInterval(() => {
        width += Math.random() * 30;
        if (width > 90) {
            clearInterval(interval);
            progressFill.style.width = '90%';
        } else {
            progressFill.style.width = width + '%';
        }
    }, 200);
}

// Show payment success
function showPaymentSuccess(notification, paymentData) {
    const progress = notification.querySelector('.payment-progress');
    const progressFill = notification.querySelector('.progress-fill');
    const progressText = notification.querySelector('.progress-text');
    
    // Complete progress bar
    progressFill.style.width = '100%';
    progressFill.style.background = 'linear-gradient(90deg, #4caf50, #45a049)';
    progressText.textContent = 'Payment completed successfully!';
    
    // Add success styling to notification
    notification.style.borderLeftColor = '#4caf50';
    notification.style.background = 'linear-gradient(135deg, #f0fff4, #ffffff)';
}

// Show payment error
function showPaymentError(notification, errorMessage) {
    const progress = notification.querySelector('.payment-progress');
    const progressFill = notification.querySelector('.progress-fill');
    const progressText = notification.querySelector('.progress-text');
    
    progressFill.style.background = 'linear-gradient(90deg, #ff6b6b, #ff5252)';
    progressText.textContent = `Payment failed: ${errorMessage}`;
    
    // Add error styling
    notification.style.borderLeftColor = '#ff6b6b';
    notification.style.background = 'linear-gradient(135deg, #fff5f5, #ffffff)';
}

// Reset notification to original state
function resetNotificationState(notification) {
    const content = notification.querySelector('.notification-content');
    const progress = notification.querySelector('.payment-progress');
    
    content.style.display = 'block';
    progress.style.display = 'none';
    
    // Reset styling
    notification.style.borderLeftColor = '#667eea';
    notification.style.background = 'white';
}

// Decline payment
async function declinePayment(transactionId) {
    try {
        // Update database to mark as declined
        const { error } = await supabase
            .from('paid_table')
            .update({
                status: 'declined',
                payment_completed_at: new Date().toISOString()
            })
            .eq('transaction_id', transactionId);
        
        if (error) {
            console.error('Error declining payment:', error);
            showToast('Failed to decline payment', 'error');
            return;
        }
        
        // Hide notification
        hideNotification(`notification-${transactionId}`);
        
        showToast('Payment declined', 'info');
        console.log(`Payment declined: ${transactionId}`);
        
    } catch (error) {
        console.error('Error in declinePayment:', error);
        showToast('Failed to decline payment', 'error');
    }
}

// Hide notification
function hideNotification(notificationId) {
    const notificationData = activeNotifications.get(notificationId);
    if (!notificationData) return;
    
    const notification = notificationData.element;
    
    // Animate out
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    
    // Remove after animation
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
        activeNotifications.delete(notificationId);
        updateNotificationBadge();
    }, 400);
}

// Mark notification as sent in database
async function markNotificationSent(transactionId) {
    try {
        const { error } = await supabase
            .from('paid_table')
            .update({ notification_sent: true })
            .eq('transaction_id', transactionId);
        
        if (error) {
            console.error('Error marking notification as sent:', error);
        }
    } catch (error) {
        console.error('Error in markNotificationSent:', error);
    }
}

// Update notification badge on bell icon
function updateNotificationBadge() {
    const badge = document.querySelector('.notification-dot');
    const activeCount = activeNotifications.size;
    
    if (badge) {
        badge.style.display = activeCount > 0 ? 'block' : 'none';
    }
}

// Update app balance (simulate balance change)
function updateAppBalance(amount) {
    const balanceElement = document.getElementById('balanceAmount');
    if (!balanceElement) return;
    
    const currentBalance = parseFloat(balanceElement.textContent.replace(/[$,]/g, ''));
    const newBalance = currentBalance + amount;
    
    // Animate balance change
    animateBalanceChange(balanceElement, currentBalance, newBalance);
}

// Animate balance change
function animateBalanceChange(element, fromAmount, toAmount) {
    const duration = 1000;
    const steps = 30;
    const stepAmount = (toAmount - fromAmount) / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
        currentStep++;
        const currentAmount = fromAmount + (stepAmount * currentStep);
        
        element.textContent = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(currentAmount);
        
        if (currentStep >= steps) {
            clearInterval(interval);
            element.textContent = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2
            }).format(toAmount);
        }
    }, duration / steps);
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `payflow-toast toast-${type}`;
    toast.textContent = message;
    
    const colors = {
        success: '#4caf50',
        error: '#ff6b6b',
        warning: '#ff9800',
        info: '#2196f3'
    };
    
    toast.style.cssText = `
        position: fixed;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: ${colors[type] || colors.info};
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10001;
        opacity: 0;
        transition: all 0.3s ease;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        max-width: calc(100vw - 40px);
        text-align: center;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Simulate payment authorization (replace with actual payment processing)
function simulatePaymentAuthorization() {
    return new Promise((resolve) => {
        setTimeout(resolve, 1500); // Simulate processing time
    });
}

// Play notification sound
function playNotificationSound() {
    try {
        // Create audio context for notification sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
        console.log('Audio notification not supported or failed');
    }
}

// Preload notification sound
function preloadNotificationSound() {
    // Prepare audio context on first user interaction
    document.addEventListener('click', function initAudio() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContext.resume();
        } catch (error) {
            console.log('Audio context initialization failed');
        }
        document.removeEventListener('click', initAudio);
    }, { once: true });
}

// Get time ago string
function getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// Cleanup function
function stopNotificationSystem() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
    
    // Clear all active notifications
    activeNotifications.forEach((data, id) => {
        hideNotification(id);
    });
    
    console.log('Notification system stopped');
}

// Add required CSS styles
const notificationStyles = `
    <style>
    .payflow-notification.show {
        opacity: 1 !important;
        transform: translateX(0) !important;
    }
    
    .notification-header {
        display: flex;
        align-items: center;
        padding: 16px 20px 12px;
        border-bottom: 1px solid #f0f0f0;
    }
    
    .notification-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
        margin-right: 12px;
    }
    
    .notification-title {
        font-size: 16px;
        font-weight: bold;
        color: #2d3748;
        flex: 1;
    }
    
    .notification-close {
        width: 30px;
        height: 30px;
        border: none;
        background: #f7fafc;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #718096;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .notification-close:hover {
        background: #e2e8f0;
        color: #2d3748;
    }
    
    .notification-content {
        padding: 16px 20px;
    }
    
    .payment-details {
        margin-bottom: 20px;
    }
    
    .payment-amount {
        font-size: 28px;
        font-weight: bold;
        color: #667eea;
        margin-bottom: 8px;
    }
    
    .payment-description {
        font-size: 16px;
        color: #2d3748;
        margin-bottom: 6px;
    }
    
    .payment-from {
        font-size: 14px;
        color: #718096;
        margin-bottom: 4px;
    }
    
    .payment-time {
        font-size: 12px;
        color: #a0aec0;
        margin-bottom: 4px;
    }
    
    .transaction-id {
        font-size: 11px;
        color: #cbd5e0;
        font-family: monospace;
    }
    
    .notification-actions {
        display: flex;
        gap: 12px;
    }
    
    .btn-decline, .btn-pay {
        flex: 1;
        padding: 12px 20px;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    }
    
    .btn-decline {
        background: #f7fafc;
        color: #718096;
        border: 1px solid #e2e8f0;
    }
    
    .btn-decline:hover {
        background: #edf2f7;
        color: #2d3748;
        transform: translateY(-1px);
    }
    
    .btn-pay {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    
    .btn-pay:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    .btn-pay:active {
        transform: translateY(0);
    }
    
    .payment-progress {
        padding: 20px;
        text-align: center;
    }
    
    .progress-bar {
        width: 100%;
        height: 4px;
        background: #e2e8f0;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 16px;
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea, #764ba2);
        border-radius: 2px;
        transition: width 0.3s ease;
        width: 0%;
    }
    
    .progress-text {
        font-size: 14px;
        color: #718096;
        font-weight: 500;
    }
    
    /* Mobile responsiveness */
    @media (max-width: 480px) {
        #payflow-notifications {
            right: 10px;
            width: calc(100vw - 20px);
        }
        
        .payment-amount {
            font-size: 24px;
        }
        
        .notification-actions {
            flex-direction: column;
        }
    }
    </style>
`;

// Inject styles into document
if (!document.getElementById('payflow-notification-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'payflow-notification-styles';
    styleElement.innerHTML = notificationStyles;
    document.head.appendChild(styleElement);
}

// Auto-initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNotificationSystem);
} else {
    initializeNotificationSystem();
}

// Export functions for manual control
window.PayFlowNotifications = {
    init: initializeNotificationSystem,
    stop: stopNotificationSystem,
    checkNow: checkForPendingPayments,
    processPayment: processPayment,
    declinePayment: declinePayment,
    config: NOTIFICATION_CONFIG
};

console.log('PayFlow Notification & Payment System loaded successfully');