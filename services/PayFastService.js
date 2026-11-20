import axios from 'axios';
import crypto from 'crypto';

class PayFastService {
    constructor() {
        this.merchantId = process.env.PAYFAST_MERCHANT_ID || '102';
        this.securedKey = process.env.PAYFAST_SECURED_KEY || 'zWHjBp2AlttNu1sK';
        this.isSandbox = (process.env.PAYFAST_SANDBOX || 'true').toLowerCase() === 'true';
    }

    /**
     * Get the base URL depending on sandbox/live mode
     */
    get baseURL() {
        return this.isSandbox
            ? 'https://ipguat.apps.net.pk/Ecommerce/api/Transaction'
            : 'https://ipg1.apps.net.pk/Ecommerce/api/Transaction';
    }

    /**
     * Get the form post URL for the frontend redirect
     */
    get formPostURL() {
        return `${this.baseURL}/PostTransaction`;
    }

    /**
     * Step 1: Get Access Token from PayFast
     * Called server-side before the user is redirected.
     *
     * @param {string} basketId   – unique order/basket identifier
     * @param {number|string} txnAmount – transaction amount
     * @param {string} currencyCode – e.g. "PKR"
     * @returns {Promise<string>} ACCESS_TOKEN
     */
    async getAccessToken(basketId, txnAmount, currencyCode = 'PKR') {
        const tokenURL = `${this.baseURL}/GetAccessToken`;

        const params = new URLSearchParams();
        params.append('MERCHANT_ID', this.merchantId);
        params.append('SECURED_KEY', this.securedKey);
        params.append('BASKET_ID', basketId);
        params.append('TXNAMT', String(txnAmount));
        params.append('CURRENCY_CODE', currencyCode);

        try {
            const response = await axios.post(tokenURL, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            const token = response.data?.ACCESS_TOKEN || response.data?.access_token;
            if (!token) {
                console.error('PayFast token response:', response.data);
                throw new Error('ACCESS_TOKEN not found in PayFast response');
            }
            return token;
        } catch (error) {
            const msg = error.response?.data?.message || error.response?.data || error.message;
            throw new Error(`PayFast Token Error: ${msg}`);
        }
    }

    /**
     * Build the full set of form fields that the frontend must POST to PayFast.
     *
     * @param {object} opts
     * @param {string} opts.token           – ACCESS_TOKEN from getAccessToken
     * @param {string} opts.basketId
     * @param {number} opts.txnAmount
     * @param {string} opts.currencyCode
     * @param {string} opts.orderDate       – "YYYY-MM-DD HH:mm:ss"
     * @param {string} opts.customerEmail
     * @param {string} opts.customerMobile
     * @param {string} opts.txnDesc
     * @param {string} opts.successUrl
     * @param {string} opts.failureUrl
     * @param {string} opts.checkoutUrl     – URL to return to when user cancels
     * @param {Array}  opts.items           – [{sku,name,price,qty}, ...]
     * @param {string} [opts.merchantName]  – display name
     * @returns {object} { formPostURL, formFields }
     */
    buildFormData(opts) {
        const fields = {
            CURRENCY_CODE: opts.currencyCode || 'PKR',
            MERCHANT_ID: this.merchantId,
            MERCHANT_NAME: opts.merchantName || 'PinacleLuxe',
            TOKEN: opts.token,
            BASKET_ID: opts.basketId,
            TXNAMT: String(opts.txnAmount),
            ORDER_DATE: opts.orderDate,
            SUCCESS_URL: opts.successUrl,
            FAILURE_URL: opts.failureUrl,
            CHECKOUT_URL: opts.checkoutUrl,
            CUSTOMER_EMAIL_ADDRESS: opts.customerEmail,
            CUSTOMER_MOBILE_NO: opts.customerMobile,
            SIGNATURE: `PAYFAST-${opts.basketId}`,
            VERSION: 'MERCHANT-CART-0.1',
            TXNDESC: opts.txnDesc || 'PinacleLuxe Purchase',
            PROCCODE: '00',
            TRAN_TYPE: 'ECOMM_PURCHASE',
        };

        // Add line items
        if (opts.items && opts.items.length > 0) {
            opts.items.forEach((item, idx) => {
                fields[`ITEMS[${idx}][SKU]`] = item.sku || `SKU-${idx}`;
                fields[`ITEMS[${idx}][NAME]`] = item.name;
                fields[`ITEMS[${idx}][PRICE]`] = String(item.price);
                fields[`ITEMS[${idx}][QTY]`] = String(item.qty);
            });
        }

        return {
            formPostURL: this.formPostURL,
            formFields: fields,
        };
    }

    /**
     * Generate the SHA-256 validation hash used to verify callback authenticity.
     * Format: SHA256( basket_id | secured_key | merchant_id | err_code )
     */
    generateValidationHash(basketId, errCode) {
        const raw = `${basketId}|${this.securedKey}|${this.merchantId}|${errCode}`;
        return crypto.createHash('sha256').update(raw).digest('hex');
    }

    /**
     * Validate a PayFast callback (success/failure redirect).
     *
     * @param {object} params – query parameters from the redirect URL
     * @returns {{ valid: boolean, isSuccess: boolean, transactionId: string, basketId: string, errCode: string, errMsg: string }}
     */
    validateCallback(params) {
        const {
            err_code,
            err_msg = '',
            transaction_id = '',
            basket_id = '',
            validation_hash = '',
        } = params;

        const calculatedHash = this.generateValidationHash(basket_id, err_code);
        const hashValid = calculatedHash.toLowerCase() === validation_hash.toLowerCase();

        // err_code "000" or "00" means success
        const isSuccess = hashValid && (err_code === '000' || err_code === '00');

        return {
            valid: hashValid,
            isSuccess,
            transactionId: transaction_id,
            basketId: basket_id,
            errCode: err_code,
            errMsg: err_msg,
        };
    }
}

export default new PayFastService();
