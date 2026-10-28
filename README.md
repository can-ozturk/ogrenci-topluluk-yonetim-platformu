# Öğrenci Topluluk Yönetim Platformu

**Atatürk Topluluğu** için geliştirilen, üniversite öğrenci topluluklarının üye, etkinlik ve organizasyon süreçlerini tek bir yerden yönetmeyi amaçlayan web tabanlı yönetim platformudur.

![Durum](https://img.shields.io/badge/durum-geliştirme%20aşamasında-yellow)
![Lisans](https://img.shields.io/badge/lisans-MIT-blue)
![PR](https://img.shields.io/badge/PRs-welcome-brightgreen)

---

## İçindekiler

- [Proje Hakkında](#-proje-hakkında)
- [Özellikler](#-özellikler)
- [Kullanıcı Rolleri](#-kullanıcı-rolleri)
- [Teknoloji Yığını](#-teknoloji-yığını)
- [Kurulum](#-kurulum)
- [Proje Yapısı](#-proje-yapısı)
- [Branch Stratejisi](#-branch-stratejisi)
- [Commit Kuralları](#-commit-kuralları)
- [Katkı Süreci](#-katkı-süreci)
- [Yol Haritası](#-yol-haritası)
- [Lisans](#-lisans)
- [İletişim](#-iletişim)

---

## 📖 Proje Hakkında

Üniversite topluluklarında üye kayıtları, etkinlik duyuruları, yoklamalar ve yönetim kurulu işleri genellikle WhatsApp grupları, Excel tabloları ve kâğıt formlar arasında dağınık şekilde yürür. Bu proje, bu süreçleri **tek bir platformda** toplayarak:

- Üye bilgilerini düzenli ve güvenli şekilde tutmayı,
- Etkinlikleri planlamayı, duyurmayı ve katılımı takip etmeyi,
- Yönetim kuruluna raporlanabilir veriler sunmayı

hedefler.

---

## ✨ Özellikler

### 👥 Üye Yönetimi
- Üyelik başvurusu ve yönetici onay süreci
- Üye profilleri (ad soyad, bölüm, sınıf, iletişim bilgisi)
- Aktif / pasif / mezun üye durumları
- Üye listesi, arama ve filtreleme
- Üyelik başlangıç ve bitiş tarihi takibi

### 📅 Etkinlik Yönetimi
- Etkinlik oluşturma, düzenleme ve iptal etme
- Tarih, saat, mekân ve kontenjan bilgisi
- Etkinliğe kayıt / katılım başvurusu
- Geçmiş etkinlik arşivi

### 📢 Duyurular ve İletişim
- Topluluk geneline duyuru yayınlama
- Etkinlik öncesi hatırlatma bildirimleri

> ⚠️ Özelliklerin bir kısmı geliştirme aşamasındadır. Güncel durum için [Yol Haritası](#-yol-haritası) bölümüne bakın.

## 🚀 Kurulum

> Aşağıdaki adımlar örnek olarak verilmiştir; projenin kullandığı teknolojiye göre güncelleyin.

### Gereksinimler
- Git
- `[Gerekli çalışma ortamı ve sürümü]`
- `[Veritabanı sunucusu]`

### Adımlar

```bash
# 1. Depoyu klonlayın
git clone https://github.com/can-ozturk/ogrenci-topluluk-yonetim-platformu.git

# 2. Proje klasörüne girin
cd ogrenci-topluluk-yonetim-platformu

# 3. Bağımlılıkları yükleyin
# [Proje için uygun komut]

# 4. Ortam değişkenlerini hazırlayın
cp .env.example .env

# 5. Uygulamayı başlatın
# [Proje için uygun komut]
```

---

## 📂 Proje Yapısı

<!-- TODO: Gerçek klasör yapına göre güncelle -->

```
ogrenci-topluluk-yonetim-platformu/
├── docs/           # Dokümantasyon
├── src/            # Kaynak kodlar
├── tests/          # Testler
├── .env.example    # Örnek ortam değişkenleri
└── README.md
```

---

## 🌿 Branch Stratejisi

Projede düzenli ve izlenebilir bir geliştirme süreci için **Git Flow'un sadeleştirilmiş** bir sürümü kullanılır.

### Ana Branch'ler

| Branch | Amaç |
|---|---|
| `main` | Kararlı, yayına hazır sürüm. Doğrudan commit atılmaz. |
| `develop` | Geliştirmelerin birleştirildiği ana çalışma branch'i. |

### Geçici Branch'ler

|---|---|---|
| `feature/` | Yeni özellik |
| `hotfix/` | `develop ve main` üzerindeki acil düzeltme |
|---|---|---|

### Akış

```
feature/* ──► develop ──► main
                 ▲
                 │
hotfix/*  ───────┴──────► develop & main
```

### Kurallar
1. `main` ve `develop` branch'lerine doğrudan push yapılmaz; değişiklikler **Pull Request** ile birleştirilir.
2. Her yeni iş, `develop` üzerinden açılan ayrı bir branch'te yapılır.
3. Branch isimleri küçük harfle, kelimeler `-` ile ayrılarak yazılır `Örnek: feature/isim-user-story-otyp1`.
4. Birleştirilen feature branch'leri silinir.
5. Her şey tamamlandıktan sonra `main` dalına merge edilir. `develop ──► main`.


---

<p align="center">
  Atatürk Topluluğu için geliştirilmektedir.
</p>