# Mobil restoran kataloqu responsive düzəlişi

## Məqsəd

Mobil ekranda restoran kataloqunda bir neçə vizual problem görünürdü:

- Restoran kartında ünvan və telefon hissəsi kənarlara çox yaxın görünürdü.
- 320-390px aralığında header aksiyaları bir sətrə sığmadığı üçün profil hissəsi sağdan kəsilirdi.
- Profil seçimi dropdown-u mobil ekranda çox geniş açılırdı və sağ/sol kənarlardan daşma riski yaradırdı.
- Xəritə modalı mobil browser bar-a çox yaxın otururdu və hündürlük balansı ağır görünürdü.

## Dəyişən kod

- `src/styles/globals.css`
  - Mobil restoran kartı üçün iç padding artırıldı.
  - Ünvan və telefon sətirləri icon + mətn üçün stabil grid düzülüşünə keçirildi.
  - Kart grid-i 320px ekranda daha rahat nəfəs alsın deyə kiçik horizontal padding əlavə edildi.
  - Public topbar üçün dar mobil ekranda iş paneli keçidi icon-only göstərilir.
  - Public topbar-da profil pill-i avatar-only göstərilir ki, sağdan kəsilməsin.
  - Mobil profil dropdown-u fixed mövqeyə keçirildi və viewport daxilində saxlanıldı.
  - Mobil xəritə modalında maksimum hündürlük və iframe hündürlüyü azaldıldı.

## UX nəticəsi

- Restoran kartı mobil ekranda daha səliqəli və oxunaqlı görünür.
- Telefon və ünvan hissəsi kart kənarına yapışmır.
- Header mobil ölçüdə daşmır.
- Profil seçimi paneli ekrana daha düzgün oturur.
- Xəritə modalı browser UI ilə daha az konflikt yaradır.

## Qeyd

`Restoran kataloqu` eyebrow label-i əvvəlki dəyişiklikdə artıq silinmişdi. Screenshot-da görünməsi deploy olunmuş versiyanın branch-dən geri qalması ilə bağlıdır.

