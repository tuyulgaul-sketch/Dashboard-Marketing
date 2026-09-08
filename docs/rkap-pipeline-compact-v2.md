# Compact RKAP Pipeline v2

The approved upload contract contains the original 21 columns followed by Tahun and optional Catatan. Cara Bayar, Kategori Nasabah, Estimasi Tanggal Closing, Metode Pengadaan, Existing Policy Number, Original Policy Year, Coverage Start, Coverage End, Renewal Type, Kurs ke IDR, Sumber Kurs, and Tanggal Kurs are not required upload columns.

The current live import must not be described as supporting this contract until its validator and publisher are updated and tested. The existing 35-column format remains supported during migration.

Ownership and reporting group are resolved from the current authoritative User Master by exact UserID. Captive I/II/III roll up to Captive Marketing; CRM I/II/III to Corporate & Retail Marketing; Advisor is identified by its official role or reporting line. The Director remains Directorate Marketing. Names are never used as lookup keys. Customer category and insurance type come from the active Product Master.

A monthly schedule is separate from closing, procurement, coverage, and payment frequency. Missing operational data must remain unknown and be completed in the operational workflow, not fabricated from the premium schedule. For non-IDR amounts, original currency values are preserved and an approved exchange rate with source and date is required before an IDR value can be published. Rates must never be guessed or silently treated as 1. The import must retain one opportunity per row, exact monthly reconciliation, duplicate protection, publisher authorization, and auditable batch provenance.

No official financial data, schemas, or permissions are changed by this document.