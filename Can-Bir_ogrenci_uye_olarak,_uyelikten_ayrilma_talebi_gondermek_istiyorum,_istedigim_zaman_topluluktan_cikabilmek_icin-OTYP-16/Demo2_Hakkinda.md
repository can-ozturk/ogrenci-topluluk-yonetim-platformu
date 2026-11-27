# Atatürk Topluluğu — Öğrenci Topluluk Yönetim Platformu

Bu depo, üniversite öğrenci topluluklarının üyelik başvurularını, etkinlik süreçlerini ve mali hareketlerini tek bir web arayüzü üzerinden yürütmek amacıyla geliştirilmiş olan **Öğrenci Topluluk Yönetim Platformu** projesinin kaynak kodlarını içermektedir. Uygulama, harici bir çatı (framework) veya derleme aracı gerektirmeksizin HTML5, CSS3, yalın JavaScript (ES5) ve Firebase servisleri (Authentication, Realtime Database ve Cloud Firestore) kullanılarak geliştirilmiştir.

---

## 1. Proje Dosya Yapısı

```text
.
├── index.html              # Üye giriş ekranı (varsayılan başlangıç sayfası)
├── register.html           # Üye kayıt ekranı
├── dashboard.html          # Onaylı üye paneli
├── admin-login.html        # Yetkili giriş ekranı
├── admin-dashboard.html    # Yetki bazlı yönetim paneli
├── assets/
│   ├── ataturk-bg.jpg      # Arayüz arka plan görseli
│   └── favicon.ico         # Tarayıcı sekme simgesi
├── css/
│   ├── style.css           # Temel tipografi, renk belirteçleri ve açık/koyu tema kuralları
│   ├── platform.css        # Giriş ve kayıt ekranlarına ait yerleşim stilleri
│   ├── admin.css           # Yönetim paneli ve ortak bileşen stilleri
│   └── dashboard.css       # Üye paneline özgü ek stiller
└── js/
    ├── firebase-config.js  # Firebase proje yapılandırması ve SDK başlatma
    ├── theme.js            # Koyu / açık tema yönetimi ve tercih kaydı
    ├── ui.js               # Bildirim kutuları, alan doğrulama ve şifre görünürlük yardımcıları
    ├── auth.js             # Üye kayıt, giriş, durum kontrolü ve veritabanı yardımcıları
    ├── view-switch.js      # Giriş ve kayıt görünümleri arası geçiş kontrolü
    ├── particles.js        # Arka plan parçacık animasyonu
    ├── effects.js          # Yüzey paralaks ve ışık efektleri
    ├── typewriter.js       # Giriş ekranı metin animasyonu
    ├── member-dashboard.js # Üye paneli iş mantığı (profil, duyurular, etkinlik katılımı)
    ├── admin.js            # Yetkili girişi, yetki doğrulama ve Üyelik Yönetimi modülü
    ├── admin-overview.js   # Yetkili Genel Bakış ekranı (profil ve şifre güncelleme)
    ├── admin-events.js     # Etkinlik Yönetimi modülü (ekleme, düzenleme, silme, katılım takibi)
    └── admin-budget.js     # Bütçe Yönetimi modülü (gelir/gider kayıtları ve hareket geçmişi)
```

---

## 2. Arayüzün Başlatılması ve İlk Karşılaşma

Uygulama statik web sayfalarından oluşmaktadır. Başlatmak için proje dizinindeki `index.html` dosyası doğrudan bir web tarayıcısında açılabilir ya da yerel bir HTTP sunucusu (örneğin `python -m http.server 5500` veya Visual Studio Code Live Server eklentisi) üzerinden sunulabilir.

`index.html` açıldığında kullanıcıyı iki sütunlu bir karşılama ekranı karşılar:

- **Sol bölüm:** Topluluk başlığı, kısa bilgilendirme metni ve platformun kapsadığı temel alanların (Etkinlikler, Duyurular, Topluluk Çalışmaları, Üyelik) özeti yer alır.
- **Sağ bölüm:** E-posta ve şifre alanlarından oluşan **Giriş Yap** formu bulunur. Formun alt satırında yeni başvurular için **Kayıt Ol** bağlantısı, yönetim görevlileri için ise **Yetkili Girişi** bağlantısı yer alır.
- **Sağ üst köşe:** Tüm sayfalarda ortak bulunan **Koyu Tema / Açık Tema** geçiş düğmesi bulunur. Seçilen tema tarayıcı hafızasında (`localStorage`) saklanır ve sonraki ziyaretlerde otomatik uygulanır.

---

## 3. Üye Kullanım Akışı

### 3.1. Kayıt Olma (`register.html`)
Üyelik başvurusu oluşturmak isteyen kullanıcı, giriş ekranındaki **Kayıt Ol** bağlantısına tıklar. Kayıt formunda aşağıdaki alanların eksiksiz doldurulması zorunludur:

1. **Ad** ve **Soyad**
2. **Öğrenci Numarası** (6 ile 12 hane arası yalnızca rakam)
3. **Bölüm**
4. **Kullanıcı Adı** (3 ile 20 karakter arası küçük harf, rakam, nokta veya alt çizgi)
5. **E-posta Adresi**
6. **Şifre** (en az 8 karakter, en az bir harf ve bir rakam) ve **Şifre Tekrar**

Sistem, aynı e-posta adresi, aynı kullanıcı adı veya aynı öğrenci numarası ile ikinci bir kayıt oluşturulmasını engeller. Başarılı bir başvurunun ardından kullanıcının kaydı veritabanına otomatik olarak **Beklemede (`pending`)** durumunda eklenir.

### 3.2. Giriş Yapma ve Hesap Durumu Kontrolü (`index.html`)
Kayıtlı bir kullanıcı e-posta ve şifresiyle giriş yaptığında sistem veritabanındaki üyelik durumunu kontrol eder:

- **Beklemede (`pending`):** Başvurunun henüz yetkili tarafından onaylanmadığı bildirilir ve panele giriş engellenir.
- **Reddedildi (`rejected`):** Başvurunun onaylanmadığı bildirilir ve oturum kapatılır.
- **Askıya Alındı (`suspended`):** Hesabın yetkili tarafından askıya alındığı uyarısı gösterilir ve oturum derhal sonlandırılır.
- **Onaylı (`approved`):** Kullanıcı doğrudan **Üye Paneli** (`dashboard.html`) ekranına yönlendirilir.

### 3.3. Üye Paneli Kullanımı (`dashboard.html`)
Üye Paneli sağ yan menü üzerinden iki bölümden oluşur:

1. **Genel Bakış:**
   - **Üye Bilgileri ve Üyelik Süresi:** Üyenin ad-soyad, kullanıcı adı, e-posta ve rol bilgilerinin yanı sıra kayıt tarihinden itibaren geçen süre (gün, ay veya yıl cinsinden) dinamik olarak hesaplanıp gösterilir.
   - **Şifre Değiştirme:** Üye, mevcut şifresini doğrulayarak yeni bir şifre belirleyebilir.
   - **Duyurular Özeti:** Topluluk yönetimi tarafından yayınlanan en güncel duyurular kronolojik sırada listelenir. Yayınlanmış duyuru bulunmaması halinde bilgilendirme metni gösterilir.
2. **Etkinlikler:**
   - Yayınlanan tüm topluluk etkinlikleri fotoğraf, tarih, başlık, açıklama ve etkinliği oluşturan kişi bilgisiyle kart düzeninde görüntülenir.
   - Tarihi henüz geçmemiş etkinliklerde **Katılıyorum** ve **Katılmıyorum** düğmeleri aktiftir. Üye katılım kararını bu düğmeler aracılığıyla kaydedebilir veya güncelleyebilir.
   - Tarihi geçmiş etkinlikler **Süresi Doldu** etiketiyle işaretlenir; bu etkinliklerde katılım düğmeleri devre dışı bırakılır.

Üst çubukta bulunan **Çıkış Yap** düğmesi oturumu sonlandırarak kullanıcıyı giriş ekranına döndürür.

---

## 4. Yetkili Kullanım Akışı ve Yetki Yapısı

Yetkili hesapları için herkese açık bir kayıt ekranı bulunmamaktadır. Yeni bir yetkili hesabı yalnızca proje yöneticisi tarafından **Firebase Console → Authentication → Users → Add User** adımı üzerinden e-posta ve şifre tanımlanarak oluşturulur.

### 4.1. İki Aşamalı Yetkili Girişi (`admin-login.html`)
1. **İlk Giriş:** Firebase Authentication üzerinden yeni eklenen bir yetkili `admin-login.html` ekranından ilk kez giriş yaptığında sistem veritabanında `/admins/{uid}` kaydını boş `authority` alanı ile oluşturur, oturumu kapatır ve hesabın onaylandığını belirterek tekrar giriş yapılmasını ister.
2. **Yetki Ataması:** Sistem yöneticisi, veritabanındaki ilgili `/admins/{uid}` kaydının `authority` alanına aşağıdaki üç geçerli değerden birini atar:
   - `uyelik-yonetimi`
   - `etkinlik-yonetimi`
   - `muhasebe`
3. **Sonraki Girişler:** `authority` alanı boş veya geçersiz ise giriş engellenir ve yetki atanmadığına dair uyarı gösterilir. Geçerli bir yetki tanımlandığında kullanıcı **Yetkili Paneli** (`admin-dashboard.html`) ekranına yönlendirilir.

Standart bir üye hesabı ile Yetkili Girişi ekranından oturum açılmaya çalışılması durumunda sistem yetkisiz erişimi engeller ve oturumu kapatır.

### 4.2. Yetki Bazlı Modül İzolasyonu (`admin-dashboard.html`)
Yetkili Paneli, oturum açan görevlinin `authority` değerine göre yan menüyü ve sayfa içeriğini dinamik olarak sınırlandırır. Her yetkili yalnızca **Genel Bakış** ekranını ve kendisine tanımlanan modülü görebilir; yetkisi dışındaki modüller arayüzden kaldırılır.

#### Genel Bakış (Tüm Yetkililer)
- Karşılama alanı, **Yetkili Bilgileri** kartı ve **Şifre Değiştirme** formu bulunur.
- Firebase Console üzerinden oluşturulan hesaplarda başlangıçta ad-soyad bilgisi yer almadığı için yetkili bu ekrandan kendi adını ve soyadını tanımlayabilir. Kaydedilen bilgi üst çubuğa ve ilgili formlara anında yansır.

#### Üyelik Yönetimi (`authority: "uyelik-yonetimi"`)
- Üst kısımda toplam üye, onay bekleyen başvuru, onaylı üye ve askıya alınan hesap sayılarını gösteren özet kartları bulunur.
- Kayıtlı üyeler en yeni kayıttan en eskiye doğru listelenir. Ad, soyad, kullanıcı adı ve e-posta alanlarına göre anlık arama yapılabilir; durum filtreleriyle liste daraltılabilir.
- Her üye satırında durumuna uygun işlemler sunulur:
  - **Onayla / Reddet:** Bekleyen başvurunun üyelik durumunu günceller.
  - **Askıya Al / Askıyı Kaldır:** Üyenin sisteme erişimini onay penceresi ile geçici olarak kapatır veya yeniden açar.
  - **Şifre Sıfırla:** Üyenin bilgilendirilmesi gerektiğine dair onay uyarısı sonrasında kayıtlı e-posta adresine şifre sıfırlama bağlantısı gönderir.
  - **Üyeliği Sil:** Üyenin veritabanı profilini ve ayrılmış kullanıcı adı ile öğrenci numarası kayıtlarını kaldırır. Kimlik doğrulama kaydının (Firebase Authentication) tamamen temizlenmesi gerektiğinde bu işlem Firebase Console üzerinden tamamlanır.

#### Etkinlik Yönetimi (`authority: "etkinlik-yonetimi"`)
- **Etkinlik Oluşturma:** Etkinlik fotoğrafı (canlı önizlemeli), etkinlik adı, oluşturan kişinin adı soyadı, takvim seçici ile belirlenen tarih (manuel klavye girişi ve geçmiş tarihler engellenmiştir) ve açıklama alanları doldurularak yeni etkinlik yayınlanır.
- **Etkinlik Listesi, Düzenleme ve Silme:** Yayınlanan etkinlikler kart düzeninde listelenir. Kart üzerine gelindiğinde açılan eylem çubuğu üzerinden:
  - **Durumu Görüntüle:** Üyelerin verdiği **Katılıyorum** ve **Katılmıyorum** yanıtlarını iki ayrı sekmede ve kişi bazlı liste halinde görüntüler.
  - **Düzenle:** Seçilen etkinliğin bilgilerini üstteki forma aktararak mevcut katılım yanıtlarını koruyacak şekilde günceller.
  - **Sil:** Onay penceresi sonrasında etkinliği ve bağlı yanıtları veritabanından kaldırır.
- Yetkililer bu ekranda etkinliklere katılım oyu kullanamaz; yalnızca özet sayıları ve katılımcı listesini inceleyebilir.

#### Bütçe Yönetimi (`authority: "muhasebe"`)
- **Genel Bakiye:** Topluluk kasası para birimi bazında (`TL` varsayılan olmak üzere `USD`, `EUR`, `GBP`) ayrı kartlarda gösterilir. Gelir eklendiğinde ilgili para birimi bakiyesi yeşil vurguyla yukarı, gider çıkarıldığında kırmızı vurguyla aşağı doğru sayılarak güncellenir.
- **Bakiye Girişi Yap:** Açılan pencere üzerinden tek işlemde 1 ile 5 arasında farklı gelir kaynağı (tutar, para birimi, kaynak açıklaması) girilerek kaydedilebilir.
- **Bakiye Çıkışı:** Açılan pencere üzerinden 1 ile 5 arasında gider kalemi girilebilir. Her para birimi için toplam çıkış tutarı mevcut bakiye ile karşılaştırılır; mevcut bakiyeyi aşan işlemlere izin verilmez.
- **Hareketleri Görüntüle:** Tüm gelir ve gider kayıtlarını tarih, yön etiketi (`Giriş` / `Çıkış`), tutar, açıklama ve işlemi kaydeden yetkili bilgisiyle kronolojik olarak listeler ve yöne göre filtreleme imkanı sunar.

---

## 5. Güvenlik ve Doğrulama Notları

- Tüm form alanlarında istemci tarafı doğrulama uygulanır; teknik veritabanı veya sunucu hata kodları son kullanıcıya gösterilmez, yalnızca geliştirici konsoluna (`F12`) kaydedilir.
- Kullanıcı girdileri arayüze HTML olarak değil, yalnızca `textContent` aracılığıyla aktarılır.
- Üye ve yetkili panelleri sayfa açılışında oturum ve yetki/onay durumunu yeniden doğrular; yetkisiz doğrudan URL erişimlerinde kullanıcı ilgili giriş ekranına yönlendirilir.
