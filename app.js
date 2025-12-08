const API_URL = 'https://cw-express-backend.onrender.com/lessons';

new Vue({
    el: '#app',
    data: {
        lessons: [],
        cart: [],
        showCart: false,
        sortBy: 'topic', // Default sort attribute
        sortOrder: 'asc', // 'asc' or 'desc'
        searchQuery: '',
        checkout: {
            name: '',
            phone: ''
        },
        orderMessage: null
    },
    
    // Lifecycle Hook: Runs when the app is loaded
    mounted() {
        this.fetchLessons();
    },

    computed: {
        // Sorts lessons based on current criteria
        sortedLessons() {
            // Create a copy of the array to avoid mutating original data directly during sort
            let sorted = [...this.lessons];

            return sorted.sort((a, b) => {
                let comparison = 0;
                
                // Get values to compare
                let valA = a[this.sortBy];
                let valB = b[this.sortBy];

                // Handle string comparison (case-insensitive)
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA > valB) {
                    comparison = 1;
                } else if (valA < valB) {
                    comparison = -1;
                }
                
                // Flip result if descending
                return this.sortOrder === 'asc' ? comparison : comparison * -1;
            });
        },

        // Checks if cart has items
        isCartEnabled() {
            return this.cart.length > 0;
        },

        // Calculates total price
        cartTotal() {
            return this.cart.reduce((total, item) => total + item.price, 0);
        },

        // Regex Validation: Name (Letters and spaces only)
        isNameValid() {
            return /^[a-zA-Z\s]+$/.test(this.checkout.name);
        },
        
        // Regex Validation: Phone (Numbers only)
        isPhoneValid() {
            return /^\d+$/.test(this.checkout.phone);
        },
        
        // Checkout Button State
        isCheckoutEnabled() {
            return this.isNameValid && this.isPhoneValid && this.cart.length > 0;
        }
    },
    
    methods: {
        // --- API INTERACTIONS ---

        // GET: Fetch all lessons
        async fetchLessons() {
            try {
                const response = await fetch(`${API_URL}/lessons`);
                if (!response.ok) throw new Error('Failed to fetch lessons');
                this.lessons = await response.json();
            } catch (error) {
                console.error("Error fetching lessons:", error);
            }
        },

        // GET: Search functionality (Search as you type)
        async handleSearch() {
            this.orderMessage = null; 
            
            if (this.searchQuery.length > 0) {
                try {
                    // Calls the Search Endpoint
                    const response = await fetch(`${API_URL}/search?q=${this.searchQuery}`);
                    if (!response.ok) throw new Error('Search failed');
                    this.lessons = await response.json();
                } catch (error) {
                    console.error("Error during search:", error);
                }
            } else {
                // Reset to full list if search is cleared
                this.fetchLessons(); 
            }
        },

        // POST & PUT: Submit Order
        async submitOrder() {
            // Prepare Order Data
            const orderPayload = {
                name: this.checkout.name,
                phone: this.checkout.phone,
                // Map cart items to simple objects for the backend
                lessons: this.cart.map(item => ({ 
                    id: item._id, 
                    topic: item.topic, 
                    price: item.price,
                    quantity: 1 // Assuming 1 per entry in cart array
                }))
            };
            
            this.orderMessage = { type: 'alert-warning', text: 'Submitting order...' };

            try {
                // 1. Save Order (POST)
                const postResponse = await fetch(`${API_URL}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });
                if (!postResponse.ok) throw new Error('Order submission failed');

                // 2. Update Lesson Spaces (PUT)
                // Identify unique lessons in cart to update their spaces
                const uniqueLessonIds = [...new Set(this.cart.map(item => item._id))];

                const updatePromises = uniqueLessonIds.map(id => {
                    // Find the lesson object in current state
                    const lesson = this.lessons.find(l => l._id === id);
                    
                    // The 'space' in 'lesson' object is already decremented locally by addToCart
                    // So we just send this new value to the backend
                    if (lesson) {
                        return fetch(`${API_URL}/lessons/${id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ space: lesson.space })
                        });
                    }
                });

                await Promise.all(updatePromises);

                // 3. Reset App State
                this.cart = [];
                this.checkout = { name: '', phone: '' };
                this.showCart = false; // Return to lessons page
                this.orderMessage = { type: 'alert-success', text: '✅ Order submitted successfully!' };
                
                // Refresh data to ensure sync with server
                // setTimeout ensures the alert is seen before refresh might clear it contextually
                setTimeout(() => { this.orderMessage = null; }, 3000); 

            } catch (error) {
                console.error("Error submitting order:", error);
                this.orderMessage = { type: 'alert-danger', text: '❌ An error occurred. Please try again.' };
            }
        },

        // --- CART MANAGEMENT ---

        addToCart(lesson) {
            // Validation: Prevent adding if stock is 0
            if (lesson.space > 0) {
                // Push a copy of the lesson to cart
                this.cart.push(lesson);
                // Decrement local space count immediately for UI reactivity
                lesson.space--; 
            }
        },
        
        removeFromCart(item, index) {
            // Find the lesson in the main lessons array to return the space
            const lessonInStore = this.lessons.find(l => l._id === item._id);
            
            if (lessonInStore) {
                lessonInStore.space++; // Return space to available stock
            }
            
            this.cart.splice(index, 1); // Remove from cart array

            if (this.cart.length === 0) {
                this.showCart = false; // Auto-close cart if empty (optional UX choice)
            }
        },

        // Helper: Construct Image URL
        getLessonImageUrl(imageName) {
            return `${API_URL}/images/${imageName}`;
        }
    }
});