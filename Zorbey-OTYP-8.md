OTYP-8: Üyelik Başvurularını Onaylama ve Reddetme

1. Tanım
Bir Topluluk Yöneticisi olarak, istiyorum ki sisteme gelen üyelik başvurularını inceleyip onaylayabileyim veya gerekçe belirterek reddedebileyim, böylece topluluğa kabul edilen resmi üyeleri güvenli ve kontrollü bir şekilde yönetebileyim.

2. Kabul Kriterleri
- AC-01 (Başvuru Listeleme): Topluluk yöneticisi panele girdiğinde durumu sadece "Beklemede" olan tüm aday üye başvurularını isim, e-posta ve başvuru tarihiyle birlikte listeleyebilmelidir.
- AC-02 (Başvuru Onaylama): Yönetici "Onayla" butonuna bastığında adayın üyelik statüsü anında "Aktif" olarak güncellenmeli ve adaya bilgilendirme e-postası gitmelidir.
- AC-03 (Başvuru Reddetme & Zorunlu Açıklama): Yönetici "Reddet" butonuna bastığında zorunlu bir "Ret Gerekçesi" penceresi açılmalıdır. Açıklama girilmeden işlem tamamlanamamalıdır.
- AC-04 (Ret Kaydı & Bildirim): Ret gerekçesi girilip onaylandığında adayın statüsü "Reddedildi" yapılmalı, açıklama veritabanına işlenmeli ve adaya ret gerekçesini içeren e-posta gönderilmelidir.
- AC-05 (Yetkilendirme): Başvuru onay/ret işlemlerine yalnızca "Yönetici" ve "Başkan" rolüne sahip kullanıcılar erişebilmelidir.

3. Test Senaryoları

Senaryo 1: Başvurunun Başarıyla Onaylanması
- Given (Önkoşul): Kullanıcı "Yönetici" rolüyle giriş yapmış ve "Üyelik Başvuruları" yönetim panelindedir.
- When (Eylem): Listede "Beklemede" duran bir adayın yanındaki "Onayla" butonuna basar.
- Then (Sonuç): Adayın durumu "Aktif" yapılır, aday bekleme listesinden kalkar ve ekranda "Başvuru başarıyla onaylandı" bildirimi gösterilir.

Senaryo 2: Başvurunun Gerekçeli Reddedilmesi
- Given (Önkoşul): Kullanıcı "Yönetici" rolüyle "Üyelik Başvuruları" sayfasındadır.
- When (Eylem): Bir adayın yanındaki "Reddet" butonuna basar, açılan kutucuğa "Eksik öğrenci belgesi" yazar ve "Reddi Onayla"ya tıklar.
- Then (Sonuç): Adayın durumu "Reddedildi" olarak kaydedilir, gerekçe sisteme işlenir ve adaya ret bildirimi iletilir.

Senaryo 3: Gerekçe Girilmeden Reddetme Engeli (Hata Durumu)
- Given (Önkoşul): Kullanıcı başvuru reddetme penceresini açmıştır.
- When (Eylem): Açıklama alanını boş bırakıp "Reddi Onayla" butonuna basmayı dener.
- Then (Sonuç): Sistem işlemi engeller ve "Lütfen bir ret gerekçesi belirtiniz" uyarısı verir.
