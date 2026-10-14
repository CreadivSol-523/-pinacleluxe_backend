import axios from 'axios';
import crypto from 'crypto';

class PayFastService {
    constructor() {
        // Note: Update baseURL when production/sandbox URL is provided by PremierPayFast
        this.baseURL = process.env.PAYFAST_BASE_URL || 'https://api.premierpayfast.com/v1';
        this.merchantId = process.env.MERCHANT_ID || '';
        this.securedKey = process.env.SECURED_KEY || '';
        this.cachedToken = null;
        this.tokenExpiry = 0;
    }

    /**
     * Generate HMAC-SHA256 secured hash
     */
    generateHash(dataString) {
        return crypto
            .createHmac('sha256', this.securedKey)
            .update(dataString)
            .digest('hex');
    }

    /**
     * Get or refresh access token from PayFast
     */
    async getToken(customerIp = '127.0.0.1') {
        if (this.cachedToken && Date.now() < this.tokenExpiry) {
            return this.cachedToken;
        }

        try {
            const params = new URLSearchParams();
            params.append('merchant_id', this.merchantId);
            params.append('secured_key', this.securedKey);
            params.append('grant_type', 'client_credentials');
            params.append('customer_ip', customerIp);
            params.append('api_version', 'v2.3');

            const response = await axios.post(`${this.baseURL}/token`, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (response.data && response.data.token) {
                this.cachedToken = response.data.token;
                const expirySec = Number(response.data.expiry) || 3600;
                this.tokenExpiry = Date.now() + (expirySec - 300) * 1000;
                return this.cachedToken;
            } else {
                throw new Error('Failed to obtain PayFast access token');
            }
        } catch (error) {
            throw new Error(`PayFast Authentication Error: ${error.response?.data?.message || error.message}`);
        }
    }

    /**
     * Step 1: Get Transaction Token for One-Time Checkout
     */
    async getTransactionToken(paymentData) {
        const token = await this.getToken(paymentData.customerIp);

        const params = new URLSearchParams();
        params.append('merchant_user_id', paymentData.merchantUserId);
        params.append('user_mobile_number', paymentData.userMobileNumber);
        params.append('account_type', paymentData.accountType);

        if (paymentData.accountNumber) params.append(paymentData.accountType === 'CARD' ? 'card_number' : 'account_number', paymentData.accountNumber);
        if (paymentData.expiryMonth) params.append('expiry_month', paymentData.expiryMonth);
        if (paymentData.expiryYear) params.append('expiry_year', paymentData.expiryYear);
        if (paymentData.cvv) params.append('cvv', paymentData.cvv);

        params.append('basket_id', paymentData.basketId);
        params.append('order_date', paymentData.orderDate);
        params.append('txnamt', paymentData.txnAmount.toFixed(2));
        if (paymentData.callbackUrl) params.append('callback_url', paymentData.callbackUrl);

        const accountNumField = paymentData.accountNumber || '';
        const hashString = `${paymentData.merchantUserId}+${paymentData.userMobileNumber}+${accountNumField}`;
        params.append('secured_hash', this.generateHash(hashString));

        const response = await axios.post(`${this.baseURL}/transaction/token`, params, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data;
    }

    /**
     * Step 2: Initiate Tokenized Payment (with OTP / 3DS)
     */
    async initiateTokenizedPayment(paymentData) {
        const token = await this.getToken(paymentData.customerIp);

        const params = new URLSearchParams();
        params.append('instrument_token', paymentData.instrumentToken);
        params.append('merchant_user_id', paymentData.merchantUserId);
        params.append('user_mobile_number', paymentData.userMobileNumber);
        params.append('basket_id', paymentData.basketId);
        params.append('order_date', paymentData.orderDate);
        params.append('txndesc', paymentData.txnDesc);
        params.append('txnamt', paymentData.txnAmount.toFixed(2));
        if (paymentData.otp) params.append('otp', paymentData.otp);
        if (paymentData.transactionId) params.append('transaction_id', paymentData.transactionId);
        if (paymentData.eci) params.append('eci', paymentData.eci);

        const hashString = `${paymentData.instrumentToken}+${paymentData.merchantUserId}+${paymentData.userMobileNumber}+${paymentData.txnAmount.toFixed(2)}+${paymentData.otp || ''}`;
        params.append('secured_hash', this.generateHash(hashString));

        const response = await axios.post(`${this.baseURL}/transaction/tokenized`, params, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data;
    }

    /**
     * Check Transaction Status
     */
    async getTransactionStatus(transactionId, customerIp = '127.0.0.1') {
        const token = await this.getToken(customerIp);
        const response = await axios.get(`${this.baseURL}/transaction/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            params: { customer_ip: customerIp }
        });
        return response.data;
    }

    /**
     * List Banks
     */
    async listBanks(customerIp = '127.0.0.1') {
        const token = await this.getToken(customerIp);
        const response = await axios.get(`${this.baseURL}/list/banks`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { customer_ip: customerIp }
        });
        return response.data;
    }
}

export default new PayFastService();
