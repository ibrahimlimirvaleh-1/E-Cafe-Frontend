# Workspace switcher modal

## Deyisikliklerin xulasesi

- `Is paneline kec` flow-u dropdown-dan modal secimine kecirildi.
- Cox profilli istifadecide `Is paneline kec` kliklendikde artiq sehife uzerinde ayrica profil/panel secim modali acilir.
- Secim edilen profil `selectProfile` ile aktiv edilir ve uygun panel route-una redirect olunur.
- Modal `Escape`, close button ve backdrop klikleri ile baglanir.
- Mobil ekranlarda modal bottom-sheet kimi acilir ve viewport-dan kesilmir.
- 480px ve daha dar ekranlarda `Is paneline kec` trigger-i icon-only qalir, amma profil secimi artiq dropdown kimi soldan kesilmir.

## Toxunulan fayllar

- `src/shared/layout/WorkspaceSwitcher.tsx`
- `src/styles/globals.css`

## UX neticesi

- Mobil brauzerde profil/panel secimi header daxilinde sixilib kesilmir.
- Istifadeci is paneline kecende secimi daha aydin, fokuslu modalda edir.
- Restoran ve rol konteksti secimden sonra evvelki kimi yenilenir.

## Test qeydləri

- Mobilde `Is paneline kec` ikonuna klik etdikde modalin acilmasi yoxlanmalidir.
- Modalda cari profilin `Cari` kimi gorunmesi yoxlanmalidir.
- Basqa profil secilende uygun panel sehifesine kecid yoxlanmalidir.
- Backdrop, close button ve `Escape` ile modalin baglanmasi yoxlanmalidir.
- Desktop-da da cox profilli istifadecide `Is paneline kec` secim flow-u yoxlanmalidir.
