# OTYP-14: Harcama Talebi Oluşturma

## 1. Tanım
Bir topluluk yöneticisi olarak, etkinlik masraflarını Muhasebe Sorumlusunun onayına sunabilmek için harcama talebi oluşturmak istiyorum.

## 2. Kabul Kriterleri
* **AC-01 (Zorunlu Alanlar):** Yönetici, yeni harcama talebi oluştururken talep tutarı, harcama gerekçesi ve ilgili etkinlik seçimi bilgilerini eksiksiz girmelidir.
* **AC-02 (Tutar Geçerliliği):** Muhasebe sürecindeki kasa bakiyesi karşılaştırmasının sağlıklı yapılabilmesi için talep tutarı alanı yalnızca sıfırdan büyük pozitif sayısal değerleri kabul etmeli; negatif, sıfır veya geçersiz formatta tutar girişi engellenmelidir.
* **AC-03 (Talebin Kaydedilmesi ve Harcama Talepleri Sayfasına Düşmesi):** Zorunlu alanlar eksiksiz ve geçerli bilgilerle doldurulduğunda harcama talebi; ilgili topluluk/departman bilgisiyle birlikte veritabanına kaydedilmeli ve otomatik olarak **"Beklemede"** statüsüyle Muhasebe Sorumlusunun eriştiği **"Harcama Talepleri"** sayfasına düşmelidir.
* **AC-04 (Hata ve Uyarı Bildirimleri):** Zorunlu alanların eksik bırakılması veya geçersiz tutar girilmesi durumlarında işlem engellenmeli; ilgili alanların altında spesifik hata mesajları gösterilmelidir.
* **AC-05 (Yetkilendirme):** Harcama talebi oluşturma sayfasına ve talep gönderme işlevine yalnızca ilgili toplulukta yönetim yetkisine sahip kullanıcılar erişebilmelidir. Yetkisiz kullanıcılara **"Yetkiniz yok"** uyarısı gösterilmelidir.

## 3. Test Senaryoları

### Senaryo 1: Harcama Talebinin Başarıyla Oluşturulması ve Muhasebe Sorumlusuna Düşmesi
* **Given (Önkoşul):** Kullanıcı, ilgili toplulukta yönetici yetkisiyle sisteme giriş yapmıştır ve "Yeni Harcama Talebi Oluştur" sayfasındadır.
* **When (Eylem):** Yönetici; pozitif bir talep tutarını, harcama gerekçesini ve ilgili etkinlik seçimini eksiksiz girip "Gönder" butonuna tıklar.
* **Then (Sonuç):** Harcama talebi başarıyla oluşturulur, kullanıcıya başarı bildirimi gösterilir ve talep **"Beklemede"** statüsüyle Muhasebe Sorumlusunun **"Harcama Talepleri"** sayfasında listelenir.

### Senaryo 2: Zorunlu Alanların Eksik Bırakılması
* **Given (Önkoşul):** Yönetici "Yeni Harcama Talebi Oluştur" sayfasındadır.
* **When (Eylem):** Yönetici; talep tutarı, harcama gerekçesi veya ilgili etkinlik seçimi alanlarından en az birini boş bırakarak formu göndermeyi dener.
* **Then (Sonuç):** Sistem form gönderimini engeller, talep kaydedilmez, "Harcama Talepleri" sayfasına düşmez ve boş bırakılan her alan için *"Bu alanın doldurulması zorunludur"* uyarısı gösterilir.

### Senaryo 3: Geçersiz Talep Tutarı Girilmesi
* **Given (Önkoşul):** Yönetici "Yeni Harcama Talebi Oluştur" sayfasındadır; harcama gerekçesini yazmış ve ilgili etkinliği seçmiştir.
* **When (Eylem):** Yönetici, talep tutarı alanına sıfır (`0`), negatif bir değer veya sayısal olmayan bir ifade girerek formu göndermeyi dener.
* **Then (Sonuç):** Sistem kaydı gerçekleştirmez ve tutar alanının altında *"Talep tutarı sıfırdan büyük geçerli bir değer olmalıdır"* uyarısı gösterilir.

### Senaryo 4: Yetkisiz Erişim Kontrolü
* **Given (Önkoşul):** Kullanıcı sisteme normal üye veya yetkisiz bir hesapla giriş yapmıştır.
* **When (Eylem):** Kullanıcı doğrudan URL üzerinden "Yeni Harcama Talebi Oluştur" bağlantısına erişmeyi veya talep kaydetme isteği (API/Form) göndermeyi dener.
* **Then (Sonuç):** Sistem işlemi engeller, kullanıcıya **"Yetkiniz yok"** uyarısı gösterir ve herhangi bir harcama talebi kaydı oluşturulmaz.
