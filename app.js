const API_URL = 'http://localhost:3000'; // CHANGE THIS TO YOUR RENDER URL AFTER DEPLOYMENT!

new Vue({
    el: '#app',
    data: {
        lessons: [],
        cart: [],
        showCart: false, // Toggles lessons/cart view (Requirement: Shopping Cart B)
        sortBy: 'subject', 
        sortOrder: 'asc', // 'asc' or 'desc'
        searchQuery: '',
        checkout: {
            name: '',
            phone: ''
        },
        orderMessage: null // For confirmation message
    },
    
    // --- Lifecycle Hook ---
    mounted() {
        // Automatically fetch lessons when the app starts
        this.fetchLessons();
    },

    // --- Computed Properties (Sorting & Validation) ---
    computed: {
        // Requirement: Sort functionality
        sortedLessons() {
            let filtered = this.lessons;

            // Sort logic
            return filtered.sort((a, b) => {
                let comparison = 0;
                let valA = (typeof a[this.sortBy] === 'string') ? a[this.sortBy].toLowerCase() : a[this.sortBy];
                let valB = (typeof b[this.sortBy] === 'string') ? b[this.sortBy].toLowerCase() : b[this.sortBy];

                if (valA > valB) {
                    comparison = 1;
                } else if (valA < valB) {
                    comparison = -1;
                }
                // Apply ascending or descending order
                return this.sortOrder === 'asc' ? comparison : comparison * -1;
            });
        },

        // Requirement: Shopping Cart A
        isCartEnabled() {
            return this.cart.length > 0;
        },

        // Requirement: Checkout C (Validation using JavaScript/Regex)
        isNameValid() {
            // Letters only (and spaces)
            return /^[a-zA-Z\s]+$/.test(this.checkout.name);
        },
        isPhoneValid() {
            // Numbers only
            return /^\d+$/.test(this.checkout.phone);
        },
        
        // Requirement: Checkout B (Button enabled when valid)
        isCheckoutEnabled() {
            return this.isNameValid && this.isPhoneValid && this.cart.length > 0;
        }
    },
    
    // --- Methods (Actions) ---
    methods: {
        // --- Fetch Functions (Requirement: Fetch A, B, C) ---
        
        // Requirement: Fetch A (GET)
        async fetchLessons() {
            try {
                const response = await fetch(`${API_URL}/lessons`);
                if (!response.ok) throw new Error('Failed to fetch lessons');
                this.lessons = await response.json();
            } catch (error) {
                console.error("Error fetching lessons:", error);
            }
        },

        // Requirement: Search as you type (Triggered by @input on search bar)
        async handleSearch() {
            // Clear message if searching
            this.orderMessage = null; 
            
            if (this.searchQuery.length > 0) {
                try {
                    const response = await fetch(`${API_URL}/search?q=${this.searchQuery}`);
                    if (!response.ok) throw new Error('Search failed');
                    this.lessons = await response.json(); // Display filtered results
                } catch (error) {
                    console.error("Error during search:", error);
                }
            } else {
                // If search query is empty, show all lessons
                this.fetchLessons(); 
            }
        },

        // Requirement: Fetch B (POST) and Fetch C (PUT)
        async submitOrder() {
            const orderPayload = {
                name: this.checkout.name,
                phone: this.checkout.phone,
                // Requirement: lessonIDs and spaces for the order
                lessons: this.cart.map(item => ({ 
                    id: item._id, 
                    topic: item.topic, 
                    price: item.price,
                    // Since cart stores one entry per space, count how many of this lesson are in the cart
                    quantity: this.cart.filter(c => c._id === item._id).length 
                }))
            };
            
            this.orderMessage = { type: 'alert-warning', text: 'Submitting order...' };

            try {
                // 1. POST the Order (Requirement: Fetch B)
                const postResponse = await fetch(`${API_URL}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });
                if (!postResponse.ok) throw new Error('Order submission failed');

                // 2. PUT Update Lesson Spaces (Requirement: Fetch C)
                // We only need to update the space on the lessons that were bought.
                const updatePromises = this.lessons.map(lesson => {
                    // Check if the current lesson is in the cart
                    const boughtCount = this.cart.filter(item => item._id === lesson._id).length;
                    
                    if (boughtCount > 0) {
                        // Calculate the new space count
                        const newSpace = lesson.space - boughtCount; 
                        
                        return fetch(`${API_URL}/lessons/${lesson._id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ space: newSpace })
                        });
                    }
                    return Promise.resolve(); // Skip if lesson wasn't bought
                });

                await Promise.all(updatePromises);

                // 3. Finalize
                this.cart = []; // Clear cart
                this.checkout = { name: '', phone: '' }; // Clear form
                this.fetchLessons(); // Refresh lesson list with new spaces
                this.showCart = false; // Go back to lessons page
                
                // Requirement: Checkout D (Confirmation message)
                this.orderMessage = { type: 'alert-success', text: '✅ Order submitted successfully and spaces updated!' };

            } catch (error) {
                console.error("Error submitting order:", error);
                this.orderMessage = { type: 'alert-danger', text: '❌ An error occurred during checkout.' };
            }
        },

        // --- Cart Functions ---

        // Requirement: Add to Cart (C)
        addToCart(lesson) {
            if (lesson.space > 0) {
                this.cart.push(lesson); // Add one instance to cart
                lesson.space -= 1; // Reduce available space
            }
        },
        
        // Requirement: Shopping Cart D (Remove)
        removeFromCart(item, index) {
            // Find the lesson in the main list by its _id
            const lessonIndex = this.lessons.findIndex(l => l._id === item._id);
            
            if (lessonIndex !== -1) {
                this.lessons[lessonIndex].space += 1; // Add space back to lesson list
            }
            
            this.cart.splice(index, 1); // Remove from cart
            
            // Clear message if cart becomes empty
            if (this.cart.length === 0) {
                this.orderMessage = null;
            }
        },

        // Helper to construct image URL
        getLessonImageUrl(imageName) {
            return `${API_URL}/images/${imageName}`;
        }
    }
});