// Requires <script src="https://js.stripe.com/clover/stripe.js"></script>

// Add your Stripe publishable key here
const stripe = Stripe(
    "",
);

let elements;
let isInitialized = false;
let checkoutToken;
let orderId;
let paymentIntentId;

// Remember to add your terms and conditions and privacy policy links
const paymentElementHtml = `
    <form id="payment-form">
      <div id="payment-element">
        <!--Stripe.js injects the Payment Element-->
      </div>

      <input type="checkbox" id="terms" name="terms" required>
      <label for="terms"> I agree to the <a href="/terms-and-conditions" target="_blank">terms and conditions</a></label><br><br>
      <input type="checkbox" id="privacy" name="privacy" required>
      <label for="privacy"> I agree to the <a href="/privacy-policy" target="_blank">privacy policy</a></label><br><br>
      <button id="submit">
        <div class="spinner hidden" id="spinner"></div>
        <span id="button-text">Pay now</span>
      </button>
      <div id="payment-message" class="hidden"></div>
    </form>
`;

async function initialize() {
    try {
        // Fetch PaymentIntent from your server
        const response = await fetch(
            `http://localhost:8000/setup-intent?cartId={{cart_id}}`,
        );
        const data = await response.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        const clientSecret = data.clientSecret;
        checkoutToken = data.checkoutToken;
        orderId = data.orderId;
        paymentIntentId = data.paymentIntentId;

        // Customize appearance
        const appearance = {
            theme: "flat",
            variables: {
                borderRadius: "4px",
                // colorPrimary: '#0055DE',
            },
            rules: {
                ".AccordionItem": {
                    border: "0",
                },
            },
        };

        // Create Stripe Elements instance
        elements = stripe.elements({
            appearance: appearance,
            clientSecret: clientSecret,
        });

        const paymentElementOptions = {
            layout: "accordion",
        };

        // Create and mount the Payment Element
        const paymentElement = elements.create(
            "payment",
            paymentElementOptions,
        );
        paymentElement.mount("#payment-element");
    } catch (error) {
        showError("Failed to initialize payment form: " + error.message);
    }
}

// Remember to handle form submission and validate terms acceptance
async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            return_url: `http://localhost:8000/complete-order?cartId={{cart_id}}&orderId=${orderId}&checkoutToken=${checkoutToken}&paymentIntentId=${paymentIntentId}`,
        },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
        showMessage(error.message);
    } else {
        showMessage("An unexpected error occurred.");
    }

    setLoading(false);
}

function showError(message) {
    const errorElement = document.getElementById("error-message");
    errorElement.textContent = message;
    document.getElementById("success-message").textContent = "";
}

function showSuccess(message) {
    const successElement = document.getElementById("success-message");
    successElement.textContent = message;
    document.getElementById("error-message").textContent = "";
}

function setLoading(isLoading) {
    const submitButton = document.getElementById("submit");
    const buttonText = document.getElementById("button-text");

    if (isLoading) {
        submitButton.disabled = true;
        buttonText.innerHTML = '<span class="spinner"></span>Processing...';
    } else {
        submitButton.disabled = false;
        buttonText.textContent = "Pay now";
    }
}

function observeCheckoutStepPayment() {
    const observer = new MutationObserver((mutationsList) => {
        for (let mutation of mutationsList) {
            if (mutation.type === "childList") {
                const paymentContentDiv = document.querySelector(
                    ".checkout-step--payment .checkout-view-content-enter-done",
                );
                
                if (
                    paymentContentDiv &&
                    !isInitialized &&
                    !document.getElementById("payment-element")
                ) {
                    paymentContentDiv.insertAdjacentHTML(
                        "beforeend",
                        paymentElementHtml,
                    );
                    initialize();
                    document
                        .querySelector("#payment-form")
                        .addEventListener("submit", handleSubmit);
                    isInitialized = true;
                    observer.disconnect();
                    return;
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Start observing
observeCheckoutStepPayment();
console.log("Observing for cheque payment method...");
