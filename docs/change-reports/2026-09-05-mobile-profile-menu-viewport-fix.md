# Mobile profile menu viewport fix

## Deyisikliklerin xulasesi

- Mobil header daxilindeki profil secim paneli `document.body` uzerinden portal kimi render edildi.
- Panel artiq header/topbar konteyneri terefinden kesilmir.
- Panelin desktop yerlesmesi tetikleyen user pill-in olcusune gore hesablanir.
- 480px ve daha dar ekranlarda panelin sag-sol mesafesi `safe-area` deyerleri ile hesablanir.
- Panelin eni `auto` ve `max-width: none` edildi ki, evvelki desktop en qaydasi mobil ekranda kesilme yaratmasin.
- Header daxilindeki uzun metnler mobilde tek setirde ellipsis yerine kontrollu wrap olur.
- Profil secim setirlerinde avatar, metn ve status badge olculeri dar ekranlara uygunlasdirildi.
- Mobil topbar daxilinde `min-width: 0` ve daha stabil yan padding tetbiq olundu.

## Toxunulan fayllar

- `src/shared/layout/UserMenu.tsx`
- `src/styles/globals.css`

## UX neticesi

- Profil dropdown-u mobil ekranda soldan kesilmir.
- Dropdown parent layout-dan asili olmadigi ucun real mobil browser chrome ile de viewport icinde qalir.
- `Cari` ve `Kec` hisseleri ekran kenarina sixilib yarim gorunmur.
- Uzun restoran adlari ve izah metnleri daha oxunaqli qalir.

## Test qeydləri

- iPhone eni olan 390px ve 393px ekranlarda profil menyusunun acilmasi yoxlanmalidir.
- 320px dar ekranda profil menyusu, restoran siyahisi ve topbar birlikde yoxlanmalidir.
- Profil secenden sonra dropdown-un baglanmasi evvelki kimi qalmalidir.
