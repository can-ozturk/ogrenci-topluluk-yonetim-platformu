# OTYP-9: Aktif Üyeleri Listeleme ve Arama

## 1. Tanım

Bir topluluk yöneticisi olarak, topluluğumun üyelik durumunu takip edebilmek için aktif üyelerin listesini görüntülemek ve bu listede arama yapmak istiyorum.

## 2. Kabul Kriterleri

- **AC-01 (Aktif Üyeleri Listeleme):** Yönetici, “Aktif Üyeler” sayfasını açtığında kendi topluluğunda üyelik durumu “Aktif” olan üyeleri ad, soyad ve e-posta bilgileriyle birlikte görebilmelidir.
- **AC-02 (Üye Arama):** Yönetici, aktif üye listesinde ad, soyad veya e-posta adresine göre arama yapabilmelidir. Arama, kısmi eşleşmeleri göstermeli ve büyük-küçük harf farkını dikkate almamalıdır.
- **AC-03 (Sonuç Bulunamaması):** Aramayla eşleşen aktif üye yoksa “Aramanıza uygun aktif üye bulunamadı” mesajı gösterilmelidir.
- **AC-04 (Aramayı Temizleme):** Arama alanı temizlendiğinde topluluğun tüm aktif üyeleri yeniden listelenmelidir.
- **AC-05 (Yetkilendirme):** Aktif üye listesine ve arama işlevine yalnızca ilgili toplulukta yönetim yetkisine sahip kullanıcılar erişebilmelidir.

## 3. Test Senaryoları

### Senaryo 1: Aktif Üyelerin Listelenmesi

- **Given (Önkoşul):** Kullanıcı topluluk yöneticisi olarak giriş yapmıştır. Topluluğunda “Aktif”, “Beklemede” ve “Reddedildi” durumlarında kayıtlar vardır.
- **When (Eylem):** Yönetici “Aktif Üyeler” sayfasını açar.
- **Then (Sonuç):** Listede yalnızca kendi topluluğundaki aktif üyelerin ad, soyad ve e-posta bilgileri gösterilir.

### Senaryo 2: Adın Bir Bölümüyle Üye Arama

- **Given (Önkoşul):** Yönetici “Aktif Üyeler” sayfasındadır ve listede “Deniz Kaya” adlı aktif bir üye vardır.
- **When (Eylem):** Yönetici arama alanına “den” yazar.
- **Then (Sonuç):** Deniz Kaya sonuçlarda görünür ve liste yalnızca aramayla eşleşen aktif üyeleri gösterir.

### Senaryo 3: Arama Sonucunun Boş Olması

- **Given (Önkoşul):** Yönetici “Aktif Üyeler” sayfasındadır.
- **When (Eylem):** Yönetici hiçbir aktif üyeyle eşleşmeyen bir e-posta adresi girer.
- **Then (Sonuç):** Liste boş kalır ve “Aramanıza uygun aktif üye bulunamadı” mesajı gösterilir.

### Senaryo 4: Aramanın Temizlenmesi

- **Given (Önkoşul):** Yönetici arama yapmıştır ve liste arama sonuçlarına göre filtrelenmiştir.
- **When (Eylem):** Yönetici arama alanını temizler.
- **Then (Sonuç):** Topluluğun tüm aktif üyeleri yeniden listelenir.

### Senaryo 5: Yetkisiz Erişim

- **Given (Önkoşul):** Kullanıcı giriş yapmıştır ancak ilgili toplulukta yönetim yetkisi yoktur.
- **When (Eylem):** Kullanıcı aktif üye listesini açmayı veya listede arama yapmayı dener.
- **Then (Sonuç):** Sistem erişimi engeller ve üye bilgilerini göstermez.
