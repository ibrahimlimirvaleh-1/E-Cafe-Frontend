# Header profil dropdown səliqələnməsi

Tarix: 2026-09-03

## Məqsəd

Header-dəki profil seçim dropdown-u vizual olaraq kobud görünürdü: avatar hissələri kəsilmiş kimi görünürdü, cari profil yalnız check icon ilə anlaşılırdı və istifadəçi üçün seçim konteksti kifayət qədər aydın deyildi.

## Dəyişikliklər

### `UserMenu`

Fayl:

- `src/shared/layout/UserMenu.tsx`

Dropdown başlığı yeniləndi:

- “Giriş profilləri” eyebrow kimi göstərilir.
- “Hansı restoranla işləyirsiniz?” əsas başlıq kimi verilir.
- Qısa izah mətni əlavə edildi ki, seçim dəyişəndə panel və məlumatların həmin restorana bağlandığı aydın olsun.

Cari profil üçün tək check icon əvəzinə “Cari” badge-i əlavə edildi. Digər profillər üçün sağda “Keç” action label-i göstərilir.

### CSS polish

Fayl:

- `src/styles/globals.css`

Dropdown row ölçüləri və grid-i səliqələndi:

- avatar ölçüsü 40x40 edildi və `min-width` verildi;
- row hündürlüyü artırıldı ki, text və avatar sıxılmasın;
- cari profil badge-i və keçid label-i ayrıca stilləndi;
- header ikon və mətn düzümü daha oxunaqlı edildi.

## Təhlükəsizlik təsiri

Bu dəyişiklik yalnız UI görünüşünü düzəldir. Aktiv profil seçimi və backend authorization məntiqinə toxunulmayıb.

## Performans təsiri

Əlavə API sorğusu və ya state hesablaması yoxdur. Sadəcə mövcud dropdown render strukturu və CSS dəyişib.

## Yoxlama planı

1. İki və ya daha çox profilli istifadəçi ilə login ol.
2. Header-də profil dropdown-u aç.
3. Avatarların tam göründüyünü yoxla.
4. Cari profilin “Cari” badge-i ilə seçildiyini yoxla.
5. Digər profilin “Keç” label-i ilə aydın göründüyünü yoxla.
6. Profilə klik etdikdə əvvəlki switch funksionallığının işlədiyini yoxla.
