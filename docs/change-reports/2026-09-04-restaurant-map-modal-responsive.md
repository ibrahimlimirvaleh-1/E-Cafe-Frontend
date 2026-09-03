# 2026-09-04 - Restoran xəritə modalının responsiv düzəlişi

## Məqsəd

Restoran kataloqunda məkan xəritəsi açıldıqda modal böyük ekranlarda kobud görünür, xəritə və başlıq hissəsi ekran ölçüsünə görə balanslı oturmurdu. Mobil ölçülərdə də xəritənin hündürlüyü və modalın maksimum ölçüsü viewport-a daha düzgün uyğunlaşmalı idi.

## Dəyişdirilən fayllar

- `src/styles/globals.css`

## Görülən işlər

### Modal ölçüsü stabilləşdirildi

`.map-dialog` üçün `100dvw` və `100dvh` əsaslı ölçülər istifadə edildi. Bu, xüsusilə mobil brauzerlərdə ünvan sətri və dinamik viewport dəyişikliklərində modalın kənara daşma riskini azaldır.

### Header daha səliqəli edildi

Başlıq və ünvan hissəsi üçün `min-width: 0`, daha uyğun padding, `overflow-wrap: anywhere` və oxunaqlı line-height əlavə edildi. Uzun restoran adı və uzun ünvan bir sətrə sıxılmır, modalın bağlama düyməsini itələmir.

### Xəritə hündürlüyü responsiv edildi

`iframe` hündürlüyü `clamp(...)` ilə idarə olunur. Desktopda xəritə kifayət qədər böyük qalır, mobil ekranlarda isə modalın daxilində daşmadan görünür.

### Alt izah mesajı əlavə edilmədi

Mockup-da göstərilən altdakı izah sətri istifadəçi təsdiqindən sonra tətbiqə əlavə edilmədi. Real modal yalnız başlıq, ünvan, bağlama düyməsi və xəritədən ibarətdir.

## Biznes təsiri

- Restoran xəritəsi daha peşəkar və az kobud görünür.
- Mobil və desktop görünüşlərdə modal ekran daxilində qalır.
- Uzun ünvan və restoran adı layout-u pozmur.
- İstifadəçi artıq əlavə izah mətni görmədən birbaşa xəritəyə fokuslanır.

## Test tövsiyələri

1. Desktop ölçüdə restoran kartında məkan düyməsinə kliklə və modalın mərkəzdə, səliqəli açıldığını yoxla.
2. Uzun restoran adı və uzun ünvan olan kartda başlıq hissəsinin bağlama düyməsinə toxunmadığını yoxla.
3. Mobil ölçüdə modalın ekran enindən daşmadığını və xəritənin görünən sahədə qaldığını yoxla.
4. Modal xaricinə klikləyəndə və bağlama düyməsinə basanda modalın bağlandığını yoxla.
