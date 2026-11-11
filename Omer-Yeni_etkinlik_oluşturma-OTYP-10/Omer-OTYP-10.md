# OTYP-10: Yeni Etkinlik Oluşturma

## 1. Tanım

Bir topluluk yöneticisi olarak, ad, tarih, yer ve kontenjan bilgilerini girerek yeni etkinlik oluşturabilmek istiyorum; böylece etkinlikleri planlı bir şekilde duyurabilirim.

## 2. Kabul Kriterleri

### AC-01 — Zorunlu Alanlar

Yönetici, yeni etkinlik oluştururken aşağıdaki bilgileri eksiksiz girmelidir:

- Etkinlik adı
- Tarih ve saat
- Mekan
- Kontenjan

### AC-02 — Geçmiş Zaman Kısıtlaması

Yönetici, sistemin mevcut tarih ve saatinden önceki bir zaman dilimi için etkinlik oluşturamamalıdır.

### AC-03 — Etkinliğin Kaydedilmesi ve Otomatik Yayını

Zorunlu alanlar eksiksiz doldurulduğunda ve geçerli bir ileri tarih/saat seçildiğinde:

- Etkinlik veritabanına kaydedilmelidir.
- Ek bir onay adımına gerek kalmadan anında duyuru panelinde yayınlanmalıdır.

### AC-04 — Hata ve Uyarı Bildirimleri

Eksik alan bırakılması ve geçmiş tarih seçilmesi durumlarında işlem engellenmeli; ilgili alanların altında spesifik hata mesajları gösterilmelidir.

### AC-05 — Yetkilendirme

Yeni etkinlik oluşturma sayfasına ve kaydetme işlevine yalnızca ilgili toplulukta yönetim yetkisine sahip kullanıcılar erişebilmelidir.

## 3. Test Senaryoları

### Senaryo 1: Yeni Etkinliğin Başarıyla Oluşturulması ve Yayınlanması

- Given (Önkoşul): Kullanıcı, ilgili toplulukta yönetici yetkisiyle sisteme giriş yapmıştır ve “Yeni Etkinlik Oluştur” sayfasındadır.
- When (Eylem): Yönetici; etkinlik adını, geçerli bir ileri tarih/saati, mekan bilgisini ve pozitif bir kontenjan değerini eksiksiz girip “Kaydet” butonuna tıklar.
- Then (Sonuç):
  - Etkinlik başarıyla oluşturulur.
  - Kullanıcıya başarı bildirimi gösterilir.
  - Etkinlik anında topluluğun duyuru panelinde listelenir.

### Senaryo 2: Zorunlu Alanların Eksik Bırakılması

- Given (Önkoşul): Yönetici “Yeni Etkinlik Oluştur” sayfasındadır.
- When (Eylem): Yönetici; etkinlik adı, tarih/saat, mekan veya kontenjan alanlarından en az birini boş bırakarak formu göndermeyi dener.
- Then (Sonuç):
  - Sistem form gönderimini engeller.
  - Etkinlik kaydedilmez ve duyuru panelinde yayınlanmaz.
  - Boş bırakılan her alan için “Bu alanın doldurulması zorunludur” uyarısı gösterilir.

### Senaryo 3: Geçmiş Gün veya Saat Seçilmesi

- Given (Önkoşul): Yönetici “Yeni Etkinlik Oluştur” sayfasındadır ve zorunlu metin alanlarını doldurmuştur.
- When (Eylem): Yönetici, takvimden geçmiş bir günün tarihini veya mevcut günün geçmiş bir saatini seçerek kaydetmeyi dener.
- Then (Sonuç):
  - Sistem kaydı gerçekleştirmez.
  - Tarih/saat alanının altında “Etkinlik tarihi geçmiş bir zaman olamaz” uyarısı gösterilir.

### Senaryo 4: Yetkisiz Erişim Kontrolü

- Given (Önkoşul): Kullanıcı sisteme normal üye veya yetkisiz bir hesapla giriş yapmıştır.
- When (Eylem): Kullanıcı, doğrudan URL üzerinden “Yeni Etkinlik Oluştur” sayfasına erişmeyi veya etkinlik kaydetme isteği (API/Form) göndermeyi dener.
- Then (Sonuç):
  - Sistem işlemi engeller.
  - Kullanıcıya “Bu işlem için yetkiniz bulunmamaktadır” hata ekranı veya mesajı gösterilir.
  - Herhangi bir etkinlik kaydı oluşturulmaz.
