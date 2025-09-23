// Initialize Supabase client
// Replace with your actual Supabase URL and anon key
const supabaseUrl = 'https://gfqzzamwcewcoihbwuwm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmcXp6YW13Y2V3Y29paGJ3dXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjQ4MjQsImV4cCI6MjA3NDEwMDgyNH0.WcoOzI08tcIcwl4gtyPY2AWjw74e23ijkLcTTqiSYCM';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Hard-coded payment information (customize these values)
const PAYMENT_DATA = {
    user_id: '588e0e8d-01a8-4e7f-9575-c10b22efc990', // The UID from your auth user
    user_name: 'work.abdirasak@gmail.com', // User name or email
    amount: 99.99, // Payment amount
    product_name: 'Premium Service', // Optional: what they're paying for
};

// Global variable to store current transaction
let currentTransaction = null;

// Function to generate unique transaction ID
function generateTransactionId() {
    return 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Function to create pending payment record
async function createPendingPayment() {
    try {
        const transactionId = generateTransactionId();
        
        const paymentData = {
            user_id: PAYMENT_DATA.user_id,
            user_name: PAYMENT_DATA.user_name,
            amount: PAYMENT_DATA.amount,
            product_name: PAYMENT_DATA.product_name,
            timestamp: new Date().toISOString(),
            status: 'pending',
            is_paid: false,
            payment_method: 'mobile_payment',
            transaction_id: transactionId,
            notification_sent: false
        };

        console.log('Creating pending payment:', paymentData);

        const { data, error } = await supabase
            .from('paid_table')
            .insert([paymentData])
            .select(); // Return the inserted data

        if (error) {
            console.error('Error creating pending payment:', error);
            return { success: false, error: error.message };
        }

        console.log('Pending payment created successfully:', data);
        return { success: true, data: data[0], transactionId };
    } catch (error) {
        console.error('Error:', error);
        return { success: false, error: error.message };
    }
}

// Function to check payment status
async function checkPaymentStatus(transactionId) {
    try {
        const { data, error } = await supabase
            .from('paid_table')
            .select('*')
            .eq('transaction_id', transactionId)
            .single();

        if (error) {
            console.error('Error checking payment status:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error:', error);
        return { success: false, error: error.message };
    }
}

// Function to simulate notification from mobile app (for testing)
async function simulatePaymentCompletion(transactionId) {
    try {
        const { data, error } = await supabase
            .from('paid_table')
            .update({ 
                is_paid: true, 
                status: 'completed',
                payment_completed_at: new Date().toISOString()
            })
            .eq('transaction_id', transactionId)
            .select();

        if (error) {
            console.error('Error completing payment:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error:', error);
        return { success: false, error: error.message };
    }
}

// Function to start payment monitoring
function startPaymentMonitoring(transactionId, maxAttempts = 60) { // 5 minutes max (60 * 5 seconds)
    let attempts = 0;
    const button = document.querySelector('.startng button');
    
    const checkInterval = setInterval(async () => {
        attempts++;
        
        // Update button text with countdown
        const remainingTime = Math.max(0, (maxAttempts - attempts) * 5);
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        button.textContent = `Waiting for payment... ${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        console.log(`Checking payment status... Attempt ${attempts}/${maxAttempts}`);
        
        const result = await checkPaymentStatus(transactionId);
        
        if (result.success && result.data.is_paid) {
            // Payment completed!
            clearInterval(checkInterval);
            button.textContent = 'Payment Completed ✓';
            button.style.backgroundColor = '#10b981';
            button.style.color = 'white';
            
            alert(`Payment Successful!\n\nTransaction ID: ${transactionId}\nAmount: $${PAYMENT_DATA.amount}\nCompleted at: ${new Date(result.data.payment_completed_at).toLocaleString()}`);
            
            // Reset button after 5 seconds
            setTimeout(() => {
                resetButton();
            }, 5000);
            
            return;
        }
        
        if (attempts >= maxAttempts) {
            // Timeout - payment not completed
            clearInterval(checkInterval);
            button.textContent = 'Payment Timeout ❌';
            button.style.backgroundColor = '#ef4444';
            button.style.color = 'white';
            
            alert('Payment timeout. Please try again or contact support.\n\nTransaction ID: ' + transactionId);
            
            // Reset button after 3 seconds
            setTimeout(() => {
                resetButton();
            }, 3000);
        }
    }, 5000); // Check every 5 seconds
    
    return checkInterval;
}

// Function to reset button to initial state
function resetButton() {
    const button = document.querySelector('.startng button');
    button.textContent = `Pay $${PAYMENT_DATA.amount}`;
    button.style.backgroundColor = '#3b82f6';
    button.style.color = 'white';
    button.disabled = false;
    currentTransaction = null;
}

// Main payment handler
async function handlePayment() {
    try {
        const button = document.querySelector('.startng button');
        
        // Prevent multiple clicks
        if (currentTransaction) {
            alert('Payment is already in progress. Please wait...');
            return;
        }
        
        // Show initial loading state
        const originalText = button.textContent;
        button.textContent = 'Creating Payment...';
        button.disabled = true;

        console.log('Starting payment process...');

        // Create pending payment record
        const result = await createPendingPayment();

        if (result.success) {
            currentTransaction = result.transactionId;
            
            // Show payment created message
            alert(`Payment request created!\n\nTransaction ID: ${result.transactionId}\nAmount: $${PAYMENT_DATA.amount}\n\nWaiting for mobile app confirmation...`);
            
            // Start monitoring payment status
            startPaymentMonitoring(result.transactionId);
            
        } else {
            alert('Failed to create payment request: ' + result.error);
            button.textContent = originalText;
            button.disabled = false;
        }

    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed: ' + error.message);
        resetButton();
    }
}

// Function to cancel current payment
function cancelPayment() {
    if (currentTransaction) {
        const confirmCancel = confirm('Are you sure you want to cancel the current payment?');
        if (confirmCancel) {
            // You can implement cancel logic here if needed
            resetButton();
            alert('Payment cancelled.');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Payment system initialized');
    
    const payButton = document.querySelector('.startng button');
    if (payButton) {
        // Set initial button text and styling
        payButton.textContent = `Pay $${PAYMENT_DATA.amount}`;
        
        // Add click event listener
        payButton.addEventListener('click', handlePayment);
        
        // Styling
        payButton.style.padding = '12px 24px';
        payButton.style.fontSize = '16px';
        payButton.style.backgroundColor = '#3b82f6';
        payButton.style.color = 'white';
        payButton.style.border = 'none';
        payButton.style.borderRadius = '6px';
        payButton.style.cursor = 'pointer';
        payButton.style.transition = 'all 0.3s';
        payButton.style.minWidth = '200px';
        
        // Hover effects
        payButton.addEventListener('mouseenter', function() {
            if (!this.disabled && !currentTransaction) {
                this.style.backgroundColor = '#2563eb';
                this.style.transform = 'translateY(-1px)';
            }
        });
        
        payButton.addEventListener('mouseleave', function() {
            if (!this.disabled && !currentTransaction) {
                this.style.backgroundColor = '#3b82f6';
                this.style.transform = 'translateY(0)';
            }
        });
    }
    
    // Add a cancel button (optional)
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel Payment';
    cancelBtn.style.display = 'none';
    cancelBtn.style.marginLeft = '10px';
    cancelBtn.style.padding = '12px 24px';
    cancelBtn.style.fontSize = '16px';
    cancelBtn.style.backgroundColor = '#ef4444';
    cancelBtn.style.color = 'white';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.addEventListener('click', cancelPayment);
    
    document.querySelector('.startng').appendChild(cancelBtn);
});

// Optional: Test function to simulate mobile app notification
window.testCompletePayment = async function(transactionId) {
    if (!transactionId && currentTransaction) {
        transactionId = currentTransaction;
    }
    
    if (transactionId) {
        console.log('Simulating payment completion for:', transactionId);
        await simulatePaymentCompletion(transactionId);
    } else {
        console.log('No transaction ID provided or current transaction');
    }
};

// Optional: Function to get all pending payments (for debugging)
window.getPendingPayments = async function() {
    try {
        const { data, error } = await supabase
            .from('paid_table')
            .select('*')
            .eq('is_paid', false);
            
        if (error) {
            console.error('Error getting pending payments:', error);
        } else {
            console.log('Pending payments:', data);
        }
        return data;
    } catch (error) {
        console.error('Error:', error);
    }
};