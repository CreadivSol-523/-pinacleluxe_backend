import PayFastService from "../services/PayFastService.js";
import OrderModel from "../models/OrderSchema.js";

/**
 * Initiate Online Payment via PayFast Gateway
 */
export const initiatePayFastPayment = async (req, res, next) => {
    try {
        const { orderId, userMobileNumber, accountType, accountNumber, expiryMonth, expiryYear, cvv } = req.body;

        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const customerIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        const orderDate = order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        // Call PayFast to get transaction token
        const txnResponse = await PayFastService.getTransactionToken({
            merchantUserId: order.user ? order.user.toString() : order.customerDetails.email,
            userMobileNumber: userMobileNumber || order.customerDetails.phone,
            accountType: accountType || 'CARD',
            accountNumber,
            expiryMonth,
            expiryYear,
            cvv,
            basketId: order._id.toString(),
            orderDate,
            txnAmount: order.totalPrice,
            customerIp: Array.isArray(customerIp) ? customerIp[0] : customerIp,
            callbackUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/order-confirmation/${order._id}`
        });

        // Save transaction ID on order if returned
        if (txnResponse.transaction_id) {
            order.paymentStatus = txnResponse.otp_required ? "Pending" : "Paid";
            await order.save();
        }

        res.status(200).json({
            success: true,
            message: "PayFast transaction token generated successfully",
            payfastResponse: txnResponse,
            orderId: order._id
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Confirm PayFast Payment with OTP (Tokenized Payment)
 */
export const confirmPayFastPayment = async (req, res, next) => {
    try {
        const { orderId, instrumentToken, merchantUserId, userMobileNumber, otp, transactionId, eci } = req.body;

        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const customerIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
        const orderDate = order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        const confirmResponse = await PayFastService.initiateTokenizedPayment({
            instrumentToken,
            merchantUserId: merchantUserId || (order.user ? order.user.toString() : order.customerDetails.email),
            userMobileNumber: userMobileNumber || order.customerDetails.phone,
            basketId: order._id.toString(),
            orderDate,
            txnDesc: `Payment for Order #${order._id}`,
            txnAmount: order.totalPrice,
            otp,
            transactionId,
            eci,
            customerIp: Array.isArray(customerIp) ? customerIp[0] : customerIp
        });

        // Check response code
        if (confirmResponse.code === "00" || confirmResponse.status_code === "00") {
            order.paymentStatus = "Paid";
            order.orderStatus = "Processing";
            await order.save();
        }

        res.status(200).json({
            success: true,
            message: "PayFast payment processed",
            payfastResponse: confirmResponse,
            order
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Banks List from PayFast
 */
export const getPayFastBanks = async (req, res, next) => {
    try {
        const customerIp = req.ip || '127.0.0.1';
        const banks = await PayFastService.listBanks(Array.isArray(customerIp) ? customerIp[0] : customerIp);
        res.status(200).json({ success: true, banks });
    } catch (error) {
        next(error);
    }
};
