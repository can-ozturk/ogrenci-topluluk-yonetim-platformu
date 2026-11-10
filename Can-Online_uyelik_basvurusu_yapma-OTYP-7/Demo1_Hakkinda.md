# Öğrenci Topluluk Yönetim Platformu

Bu çalışma, üniversite bünyesinde faaliyet gösteren öğrenci topluluklarının idari, organizasyonel ve iletişim süreçlerini tek bir merkezden yürütmek amacıyla geliştirilen web tabanlı bir yönetim sistemidir. Depoda yer alan mevcut sürüm, projenin temel mimarisini, kullanıcı arayüzü tasarımını ve kimlik doğrulama altyapısını ortaya koyan bir ön gösterim (prototip) niteliğindedir.

---

## Kullanıcı Arayüzü ve Sistemin Kullanımı

Uygulama başlatıldığında (`index.html` veya `register.html`) kullanıcıyı iki sütunlu ana kimlik doğrulama ekranı karşılar. Arayüz; erişilebilirlik standartları, istemci tarafı veri doğrulama kuralları ve bulut tabanlı veritabanı entegrasyonu temel alınarak yapılandırılmıştır.

### 1. Ekran Düzeni ve Arayüz Bileşenleri

* **Tanıtım Alanı (Sol Sütun):** Topluluk başlığı, sistemin amacını özetleyen açıklama metni ve platformun dört temel bileşenini (Etkinlikler, Duyurular, Topluluk Çalışmaları, Üyelik) gösteren bilgilendirme kartı yer alır. Bu bölüm, giriş ve kayıt görünümleri arasında geçiş yapılırken sabit kalır.
* **İşlem Alanı (Sağ Sütun):** Kullanıcının tercihine göre "Giriş Yap" veya "Kayıt Ol" formlarını barındıran etkileşimli karttır. Görünümler arasındaki geçişler sayfa yenilenmesine gerek kalmadan gerçekleştirilir.
* **Tema Kontrolü (Sağ Üst Köşe):** Kullanıcının ekranı açık veya koyu tema seçenekleriyle görüntülemesini sağlayan kontrol düğmesi bulunur. Seçilen tema tercihi tarayıcı belleğinde saklanır ve sonraki oturumlarda korunur.

### 2. Üyelik Başvurusu (Kayıt Ol)

Sistemi ilk kez kullanacak öğrencilerin topluluğa katılmak için kayıt formunu eksiksiz doldurması gerekmektedir. Kayıt ekranına sağ sütunun alt kısmındaki "Kayıt Ol" bağlantısı üzerinden veya doğrudan `register.html` sayfasından erişilir.

Kayıt aşamasında kullanıcıdan aşağıdaki bilgiler talep edilir ve her alan istemci tarafında doğrulanır:

* **Ad ve Soyad:** Yalnızca harflerden oluşmalı ve her biri 2 ila 40 karakter uzunluğunda olmalıdır.
* **Öğrenci Numarası:** Yalnızca rakamlardan oluşan, 6 ila 12 haneli öğrenci numarası girilmelidir.
* **Bölüm:** Öğrencinin kayıtlı olduğu akademik program veya bölüm adı (2–80 karakter) yazılmalıdır.
* **Kullanıcı Adı:** 3 ila 20 karakter uzunluğunda olmalı; yalnızca küçük harf, rakam, nokta (`.`) ve alt çizgi (`_`) içermelidir.
* **E-posta Adresi:** Geçerli standartlarda bir e-posta adresi girilmelidir.
* **Şifre ve Şifre Tekrarı:** Güvenlik gereksinimleri doğrultusunda şifre en az 8 karakter uzunluğunda olmalı, en az bir harf ve bir rakam içermelidir. Şifre tekrar alanı, girilen değerlerin eşleşip eşleşmediğini anlık olarak kontrol eder. Alanların sağ tarafındaki simge aracılığıyla şifre görünürlüğü değiştirilebilir.

Form gönderildiğinde sistem; öğrenci numarası, kullanıcı adı ve e-posta adresinin daha önce kaydedilip kaydedilmediğini veritabanı üzerinden denetler. Bilgilerde çakışma bulunmaması halinde başvuru kaydı oluşturulur ve üyelik durumu **"Beklemede"** olarak tanımlanır. Yönetici onayı tamamlanana kadar yeni oluşturulan hesapla oturum açılmasına izin verilmez.

### 3. Oturum Açma (Giriş Yap) ve Üye Paneli

Kayıt işlemini tamamlamış kullanıcılar, "Giriş Yap" ekranında e-posta adreslerini ve şifrelerini girerek kimlik doğrulama talebinde bulunur.

* **Onay Bekleyen Hesaplar:** Üyelik başvurusu henüz topluluk yönetimi tarafından onaylanmamış bir kullanıcı giriş yaptığında, sistem başvurunun onay aşamasında olduğunu belirten bir bilgilendirme mesajı gösterir ve oturumu güvenli biçimde sonlandırır.
* **Onaylanmış Hesaplar:** Kimlik doğrulaması ve üyelik durumu uygun olan kullanıcılar üye paneline (`dashboard.html`) yönlendirilir. Üye panelinde kullanıcının hesap bilgileri (kullanıcı adı, e-posta adresi ve topluluk içindeki rolü) görüntülenir. Oturumu sonlandırmak için panel üzerindeki "Çıkış Yap" düğmesi kullanılır.
* **Hata Yönetimi:** Eksik veya hatalı veri girişlerinde ilgili form alanının altında doğrulama uyarısı gösterilir; kimlik doğrulama veya bağlantı kaynaklı durumlarda ise formun üst kısmındaki bildirim kutusu aracılığıyla kullanıcı bilgilendirilir.

---

## Proje Kapsamı ve Planlanan Özellikler

Bu proje aşamalı bir geliştirme planı doğrultusunda yürütülmektedir. Mevcut sürüm bir demo niteliğinde olup, aşağıda listelenen modüllerin bir kısmı aktif olarak çalışmakta, bir kısmı ise geliştirme aşamasında bulunmaktadır. Sistemin nihai sürümünde yer alacak temel modüller ve işlevler şunlardır:

### Üye Yönetimi
* Üyelik başvurusu ve yönetici onay süreci
* Üye profilleri (ad soyad, bölüm, sınıf, iletişim bilgisi)
* Aktif, pasif ve mezun üye durumları
* Üye listesi, arama ve filtreleme
* Üyelik başlangıç ve bitiş tarihi takibi

### Etkinlik Yönetimi
* Etkinlik oluşturma, düzenleme ve iptal etme
* Tarih, saat, mekân ve kontenjan bilgisi
* Etkinliğe kayıt ve katılım başvurusu
* Geçmiş etkinlik arşivi

### Duyurular ve İletişim
* Topluluk geneline duyuru yayınlama
* Etkinlik öncesi hatırlatma bildirimleri

> **Not:** Yukarıda belirtilen özelliklerin bir kısmı hâlen geliştirme aşamasındadır. Mevcut prototip sürümde kullanıcı kayıt, benzersizlik denetimi, kimlik doğrulama ve başvuru onay durumu kontrolü süreçleri tamamlanmıştır. Diğer yönetim ve organizasyon modülleri ilerleyen sürümlerde sisteme entegre edilecektir.

---

