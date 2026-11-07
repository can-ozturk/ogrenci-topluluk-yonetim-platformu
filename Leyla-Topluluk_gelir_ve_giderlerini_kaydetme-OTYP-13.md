# User Story: Topluluk Gelir ve Gider Yönetimi

## 1. Tanım
**Bir** Topluluk Başkanı / Mali İşler Sorumlusu olarak,  
**İstiyorum ki** topluluğa ait gelir ve giderleri (tutar, kategori, tarih ve fiş/fatura ile) sisteme kaydedebileyim,  
**Böylece** topluluğun bütçesini şeffaf bir şekilde takip edip güncel bakiyeyi görebileyim.

## 2. Kabul Kriterleri 
* **AC-01 (Gelir Kaydı):** Kullanıcı; gelir türü, tutar, tarih ve açıklama girerek gelir ekleyebilmelidir.
* **AC-02 (Gider Kaydı):** Kullanıcı; gider türü, tutar ve tarih girerek gider ekleyebilmelidir.
* **AC-03 (Fatura/Fiş):** Gider kayıtlarına isteğe bağlı olarak fatura veya fiş görseli eklenebilmelidir.
* **AC-04 (Bakiye Güncelleme):** Yapılan her kayıt sonrası toplam bütçe ve bakiye otomatik olarak güncellenmelidir.
* **AC-05 (Yetkilendirme):** Kayıt ekleme işlemlerini sadece "Başkan" ve "Mali İşler Sorumlusu" yapabilmelidir.

## 3. Test Senaryosu (Given-When-Then)
* **Given (Önkoşul):** Kullanıcı Başkan rolüyle "Finans Yönetimi" sayfasındadır.
* **When (Eylem):** 500 TL tutarında "Afiş Basımı" gideri girer ve "Kaydet"e basar.
* **Then (Sonuç):** Sistem kaydı oluşturur ve toplam bakiyeden 500 TL düşer.

## 4. Veri Alanları
| Alan Adı | Veri Tipi | Zorunlu mu? | Açıklama |
| :--- | :--- | :---: | :--- |
| `transaction_id` | String | Evet | Benzersiz işlem numarası |
| `type` | Enum | Evet | İşlem türü (Gelir / Gider) |
| `category` | String | Evet | İşlem kategorisi |
| `amount` | Decimal | Evet | Tutar (TL) |
| `date` | Date | Evet | İşlem tarihi |
| `receipt_url` | String | Hayır | Fatura/Fiş görsel adresi |

