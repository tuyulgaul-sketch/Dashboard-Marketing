# XLSX upload release gate

This release is limited to Arianie's three upload templates and their readers. The implementation must preserve the original Target cascading, Bulk Pipeline duplicate checks, existing published data and official-period replacement behavior. No production data is seeded, reset or migrated.

The generated XLSX must contain exactly one named data sheet and a second current User Master reference sheet. Production ownership is resolved only by the required User ID; invalid IDs block publication. CSV compatibility does not permit missing owner IDs. A successful native XLSX read and roundtrip is required before merging. The temporary source-generation workflow must be removed before production release.
