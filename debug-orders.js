// Debug script to check order data structure
const fs = require('fs');

// Create a simple HTML file to check localStorage
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Debug Orders</title>
</head>
<body>
    <h1>Order Debug</h1>
    <div id="output"></div>
    
    <script>
        // Check existing orders
        const orders = localStorage.getItem('yellowbell_orders');
        const customerOrders = localStorage.getItem('yellowbell_customer_orders');
        
        let output = '<h2>Orders in localStorage:</h2>';
        
        if (orders) {
            const parsedOrders = JSON.parse(orders);
            output += '<h3>Regular Orders (' + parsedOrders.length + '):</h3>';
            parsedOrders.forEach((order, index) => {
                output += '<div style="border: 1px solid #ccc; margin: 10px; padding: 10px;">';
                output += '<strong>Order ' + (index + 1) + ':</strong><br>';
                output += 'ID: ' + order.id + '<br>';
                output += 'Customer: ' + order.customerName + '<br>';
                output += 'Meal Type: ' + (order.mealType || 'undefined') + '<br>';
                output += 'Original Meal Type: ' + (order.originalMealType || 'undefined') + '<br>';
                output += 'Cook Time: ' + (order.cookTime || 'undefined') + '<br>';
                output += 'Created At: ' + (order.createdAt || 'undefined') + '<br>';
                output += '</div>';
            });
        } else {
            output += '<p>No regular orders found</p>';
        }
        
        if (customerOrders) {
            const parsedCustomerOrders = JSON.parse(customerOrders);
            output += '<h3>Customer Orders (' + parsedCustomerOrders.length + '):</h3>';
            parsedCustomerOrders.forEach((order, index) => {
                output += '<div style="border: 1px solid #ccc; margin: 10px; padding: 10px;">';
                output += '<strong>Customer Order ' + (index + 1) + ':</strong><br>';
                output += 'ID: ' + order.id + '<br>';
                output += 'Customer: ' + order.customerName + '<br>';
                output += 'Meal Type: ' + (order.mealType || 'undefined') + '<br>';
                output += 'Original Meal Type: ' + (order.originalMealType || 'undefined') + '<br>';
                output += 'Cook Time: ' + (order.cookTime || 'undefined') + '<br>';
                output += 'Created At: ' + (order.createdAt || 'undefined') + '<br>';
                output += '</div>';
            });
        } else {
            output += '<p>No customer orders found</p>';
        }
        
        document.getElementById('output').innerHTML = output;
    </script>
</body>
</html>
`;

fs.writeFileSync('./debug-orders.html', htmlContent);
console.log('Debug HTML file created: debug-orders.html');
console.log('Open this file in your browser to check the order data structure.');
