# Root Cause Analysis (RCA) & Technical Inquiry
## Kendala Pengujian Sandbox DOKU / DANA SNAP API: Refund Order & Cancel Order

---

### Informasi Merchant
* **Merchant Name**: SatuLabs (`satulabs.id`)
* **Merchant ID**: `216620020009045417955`
* **Partner ID**: `2026092513495540511506`
* **Channel ID**: `95221`
* **Base URL Sandbox**: `https://api.sandbox.dana.id`
* **Tanggal & Waktu Pengujian**: `09 Oktober 2026, 15:28:02 WIB`

---

## 1. Ringkasan Kendala (Issue Summary)

Kami telah menjalankan serangkaian pengujian integrasi DANA SNAP API pada lingkungan Sandbox untuk skenario **Refund Order** dan **Cancel Order**. Seluruh tahapan pembuatan order dan pembayaran awal (Virtual Account) berhasil mencapai status **`00 (SUCCESS)`**. 

Namun, saat menjalankan pengujian API Refund dan Cancel pada transaksi yang telah berhasil dibayar tersebut, sistem DANA Sandbox mengembalikan respons error `5005801` (Internal Server Error) dan `4035815` (Transaction Not Permitted), sehingga skenario kepatuhan (compliance) tidak dapat diselesaikan.

---

## 2. Rincian Pengujian & Kronologi Langkah yang Dilakukan

### Langkah Persiapan (Setup Pre-requisite)
1. Membuat transaksi pembayaran baru via API `/payment-gateway/v1.0/debit/payment-host-to-host.htm`.
2. Melakukan simulasi pelunasan pembayaran Virtual Account.
3. Memeriksa status transaksi via API `/payment-gateway/v1.0/debit/status.htm`:
   * **Partner Reference No**: `RCA_34482722`
   * **DANA Reference No**: `20261009111230999500166133700703497`
   * **Latest Transaction Status**: **`00 (SUCCESS)`**

---

### Skenario 1: Merchant Requests Refund Order (Target: 2005800)

* **Test Scenario**: Merchant Requests Refund Order and gets success response.
* **Endpoint**: `POST /payment-gateway/v1.0/debit/refund.htm`
* **Expected Response**: `responseCode: 2005800` (`responseMessage: success / Successful`)
* **Waktu Eksekusi**: `15:28:07 WIB`

#### Request Headers:
```http
Content-Type: application/json
ORIGIN: https://satulabs.id
X-TIMESTAMP: 2026-10-09T15:28:07+07:00
X-PARTNER-ID: 2026092513495540511506
X-EXTERNAL-ID: a77e583d-5b1c-4e47-83d1-140be81920d9
CHANNEL-ID: 95221
X-SIGNATURE: D0o/zUHXv0SaVMMFY+iKaoiHwIlTfQL8DkBNhAX0lwogTjeKqw41+mdl2mIdj+Wi6fhI2hH8tDa/OG2+3beSv3bX5xYCoGO11Zckso1jShyv1Uhr7HotNgFwHe72rFy9h7lCUKSvrffCAOT0tAhjpeZ0en8qJCbeBsPM/Uin2CZTLlGAia0uSTxvHijL1cybroVdU4JMmlawpFB28scZkE9dXQBCDZfAsRiC8tPIjtKIDaTXwkOR8ej61Gjt/820FoB9vy8evlnlBRF+us20i8dwP8INWYLrMboSHnZY4l7JVyCpDF/pjgFQdJS+QEYUcj+eBKSv5NxwgzE6VDbyTA==
```

#### Request Body:
```json
{
  "merchantId": "216620020009045417955",
  "subMerchantId": "",
  "originalPartnerReferenceNo": "RCA_34482722",
  "originalReferenceNo": "20261009111230999500166133700703497",
  "originalExternalId": "",
  "originalCaptureNo": "",
  "partnerRefundNo": "REF_34487252",
  "refundAmount": {
    "value": "10000.00",
    "currency": "IDR"
  },
  "externalStoreId": "",
  "reason": "Customer request refund",
  "additionalInfo": {}
}
```

#### Actual Response dari DANA Sandbox:
* **HTTP Status**: `500 Internal Server Error`
* **Response Body**:
```json
{
  "responseCode": "5005801",
  "responseMessage": "Internal Server Error",
  "refundAmount": {
    "value": "1000000",
    "currency": "IDR"
  }
}
```
* **Hasil**: ❌ Gagal mendapatkan `2005800`.

---

### Skenario 2: Merchant Requests Refund Order - Inconsistent Request (Target: 4045818)

* **Test Scenario**: Merchant Requests Refund Order and gets error Inconsistent Request.
* **Endpoint**: `POST /payment-gateway/v1.0/debit/refund.htm`
* **Expected Response**: `responseCode: 4045818` (`responseMessage: Inconsistent Request`)
* **Langkah Sesuai Panduan DANA**:
  1. Mengirimkan request refund pertama dengan `partnerRefundNo`.
  2. Mengirimkan request refund kedua dengan `partnerRefundNo` yang sama tetapi `refundAmount` berbeda (`value: 435815.00`).

#### Request Body Panggilan Kedua:
```json
{
  "merchantId": "216620020009045417955",
  "subMerchantId": "",
  "originalPartnerReferenceNo": "RCA_34482722",
  "partnerRefundNo": "RCA_34482722",
  "refundAmount": {
    "value": "435815.00",
    "currency": "IDR"
  },
  "reason": "Inconsistent 2nd call",
  "additionalInfo": {}
}
```

#### Actual Response dari DANA Sandbox:
* **HTTP Status**: `403 Forbidden`
* **Response Body**:
```json
{
  "responseCode": "4035815",
  "responseMessage": "Transaction Not Permitted",
  "originalPartnerReferenceNo": "RCA_34482722",
  "partnerRefundNo": "RCA_34482722",
  "refundAmount": {
    "value": "435815.00",
    "currency": "IDR"
  }
}
```
* **Hasil**: ❌ DANA mengembalikan `4035815` (Transaction Not Permitted) alih-alih `4045818` (Inconsistent Request).

---

### Skenario 3: Cancel Failed due to Order has been Refunded (Target: 4045700)

* **Test Scenario**: Merchant Requests Cancel Order and gets Invalid Transaction Status response.
* **Endpoint**: `POST /payment-gateway/v1.0/debit/cancel.htm`
* **Expected Response**: `responseCode: 4045700` (`responseMessage: Invalid Transaction Status`)
* **Waktu Eksekusi**: `15:28:10 WIB`

#### Request Body:
```json
{
  "merchantId": "216620020009045417955",
  "subMerchantId": "",
  "originalPartnerReferenceNo": "RCA_34482722",
  "originalReferenceNo": "20261009111230999500166133700703497",
  "originalExternalId": "",
  "reason": "Order has already been refunded",
  "amount": {
    "value": "10000.00",
    "currency": "IDR"
  },
  "additionalInfo": {}
}
```

#### Actual Response dari DANA Sandbox:
* **HTTP Status**: `500 Internal Server Error`
* **Response Body**:
```json
{
  "responseCode": "5005701",
  "responseMessage": "Internal Server Error"
}
```
* **Hasil**: ❌ DANA mengembalikan `5005701` (Internal Server Error) alih-alih `4045700` (Invalid Transaction Status).

---

## 3. Pertanyaan & Permohonan Bantuan ke Tim DANA (Inquiry Points)

1. **Kendala Refund 5005801**:
   Mohon bantuan untuk memeriksa log internal server DANA Sandbox pada endpoint `/payment-gateway/v1.0/debit/refund.htm` pada tanggal `09 Oktober 2026 15:28:07 WIB` untuk transaksi `RCA_34482722`. Mengapa refund pada transaksi yang telah berstatus `00 (SUCCESS)` menghasilkan `5005801 Internal Server Error`?

2. **Mocking Skenario Inconsistent Request (4045818)**:
   Mohon konfirmasi apakah terdapat parameter/nominal khusus selain `435815.00` agar Sandbox memicu response code `4045818 Inconsistent Request` pada akun merchant kami.

3. **Skenario Cancel Order yang Telah di-Refund (4045700)**:
   Karena proses refund awal terkendala `5005801`, status transaksi di core DANA belum berstatus refunded sehingga pemanggilan cancel menghasilkan `5005701`. Mohon arahan cara memicu `4045700` secara manual di environment Sandbox jika proses refund mengalami kendala.
