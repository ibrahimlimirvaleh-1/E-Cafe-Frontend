# Restoran kataloqu eyebrow mətninin silinməsi

## Məqsəd

Əsas restoran siyahısı səhifəsində başlığın üstündə görünən `Restoran kataloqu` mətni vizual olaraq artıq və lazımsız görünürdü.

## Dəyişən kod

- `src/pages/customer/RestaurantCatalogPage.tsx`
  - `PageHeader` komponentindən `eyebrow="Restoran kataloqu"` prop-u silindi.
  - Əsas başlıq dəyişmədən saxlanıldı: `Restoran seç və rezervasiyaya başla`.

## Nəticə

Səhifə daha təmiz görünür və üst hissədə təkrarlanan kiçik label artıq göstərilmir.

