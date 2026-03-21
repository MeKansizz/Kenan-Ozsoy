# Lessons Learned

## 2026-03-22: Hafta Bazlı Gruplama

### Ne yapıldı
- Ödemeler ve siparişler tabloları ISO hafta numarasına göre gruplandı
- Form'larda tarih seçilince hafta numarası badge olarak gösterildi
- Fragment key uyarısı: `<>` yerine `<Fragment key={...}>` kullanılmalı

### Ders
- React'te map içinde Fragment kullanırken `<Fragment key>` ile key verilmeli, `<>` shorthand key desteklemiyor
- Vite HMR bazen eski hataları cache'liyor — sunucuyu restart etmek çözer
- `getWeekNumber()` ISO 8601 standardına uygun hesaplanmalı (Pazartesi başlangıç)
