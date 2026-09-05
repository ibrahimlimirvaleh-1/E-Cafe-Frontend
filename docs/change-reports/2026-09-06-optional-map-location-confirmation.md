# Optional map location confirmation

## Deyisikliklerin xulasesi

- Restoran yaradilisinda xerite koordinati secimi mecburi olmadi.
- Restoran redaktesinde xerite koordinati secimi mecburi olmadi.
- `Xeritede axtar` duymesinin metni `Xeritede tesdiqle` olaraq yenilendi.
- Manual unvan yazildiqda ve koordinat secilmedikde admin formunda xeberdarliq gosterilir.
- Public restoran kataloqunda koordinati olmayan restoranlarda unvan kliklenen xerite duymesi kimi gosterilmir.
- Koordinati olan restoranlarda evvelki kimi unvana kliklendikde xerite modali acilir.
- Admin restoran detail sehifesine xerite tesdiq statusu elave edildi.

## Backend qeydleri

- Backend-de elave kod deyisikliyine ehtiyac olmadi.
- `Latitude` ve `Longitude` request DTO-larinda artiq nullable idi.
- Validatorlar koordinati mecburi etmir, yalniz biri gonderildikde ikisinin birlikde olmasini ve araliqda olmasini yoxlayir.

## Toxunulan fayllar

- `src/pages/admin/RestaurantManagementPage.tsx`
- `src/pages/admin/RestaurantEditPage.tsx`
- `src/pages/admin/RestaurantDetailPage.tsx`
- `src/pages/customer/RestaurantCatalogPage.tsx`
- `src/styles/globals.css`

## UX neticesi

- Admin restorani manual unvanla yarada ve redakte ede bilir.
- Musteri koordinati olmayan restoranda bos ve ya qeyri-deqiq xerite modalina dusmur.
- Admin panelde unvanin xeritede tesdiqlenib-tesdiqlenmediyi aydin gorunur.

## Test qeydləri

- Yeni restoran yaradarken yalniz manual `Mekan` yazib saxlamani yoxlayin.
- Manual unvan yazildiqda `Unvan xeritede tesdiqlenmeyib` xeberdarliginin gorunmesini yoxlayin.
- Xeritenden netice secildikde xeberdarligin `Secilmis mekan` mesaji ile evez olunmasini yoxlayin.
- Koordinatsiz restoran public kataloqda unvan kliklemeyende xerite modalinin acilmamasini yoxlayin.
- Koordinatli restoran public kataloqda unvana kliklendikde xerite modalinin acilmasini yoxlayin.
- Admin restoran detail sehifesinde xerite statusunun duzgun gorunmesini yoxlayin.
