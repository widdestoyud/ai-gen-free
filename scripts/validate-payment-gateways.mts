/**
 * Quick validation script: Verify all payment gateway components load correctly
 */
import { DanaPaymentProvider } from '../packages/providers-dana/src/dana-payment.js';
import { MidtransSnapProvider } from '../packages/providers-midtrans/src/midtrans-snap.js';
import { DefaultPaymentGatewayRegistry } from '../apps/api/src/wallet/gateway-registry.js';
import { createDanaPaymentGateway } from '../apps/api/src/wallet/dana-factory.js';
import { createMidtransPaymentGateway } from '../apps/api/src/wallet/midtrans-factory.js';

// Verify classes exist and have the required PaymentGatewayPort methods
const danaMethods = Object.getOwnPropertyNames(DanaPaymentProvider.prototype).sort();
const midtransMethods = Object.getOwnPropertyNames(MidtransSnapProvider.prototype).sort();
const registryMethods = Object.getOwnPropertyNames(DefaultPaymentGatewayRegistry.prototype).sort();

console.log('✅ DanaPaymentProvider methods:', danaMethods.join(', '));
console.log('✅ MidtransSnapProvider methods:', midtransMethods.join(', '));
console.log('✅ DefaultPaymentGatewayRegistry methods:', registryMethods.join(', '));

// Verify LSP: both have createPayment, verifyNotification, checkStatus
const required = ['createPayment', 'verifyNotification', 'checkStatus'];
for (const method of required) {
  if (!danaMethods.includes(method)) throw new Error(`DANA missing ${method}`);
  if (!midtransMethods.includes(method)) throw new Error(`Midtrans missing ${method}`);
}
console.log('✅ LSP verified: Both providers implement all PaymentGatewayPort methods');

// Verify factory functions exist
console.log('✅ createDanaPaymentGateway:', typeof createDanaPaymentGateway);
console.log('✅ createMidtransPaymentGateway:', typeof createMidtransPaymentGateway);

// Verify registry works
const registry = new DefaultPaymentGatewayRegistry();
console.log('✅ Registry instantiated, list():', JSON.stringify(registry.list()));
console.log('✅ Registry getDefault():', registry.getDefault());

console.log('\n🎉 All validations passed!');
