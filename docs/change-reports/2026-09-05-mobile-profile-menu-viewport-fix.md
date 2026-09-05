# Mobile profile menu viewport fix

## Deyisikliklerin xulasesi

- Mobil header daxilindeki profil secim paneli `site-topbar` kontekstinde viewport-a baglandi.
- 480px ve daha dar ekranlarda panelin sag-sol mesafesi `safe-area` deyerleri ile hesablanir.
- Panelin eni `auto` ve `max-width: none` edildi ki, evvelki desktop en qaydasi mobil ekranda kesilme yaratmasin.
- Header daxilindeki uzun metnler mobilde tek setirde ellipsis yerine kontrollu wrap olur.
- Profil secim setirlerinde avatar, metn ve status badge olculeri dar ekranlara uygunlasdirildi.
- Mobil topbar daxilinde `min-width: 0` ve daha stabil yan padding tetbiq olundu.

## Toxunulan fayllar

- `src/styles/globals.css`

## UX neticesi

- Profil dropdown-u mobil ekranda soldan kesilmir.
- `Cari` ve `Kec` hisseleri ekran kenarina sixilib yarim gorunmur.
- Uzun restoran adlari ve izah metnleri daha oxunaqli qalir.

## Test qeydləri

- iPhone eni olan 390px ve 393px ekranlarda profil menyusunun acilmasi yoxlanmalidir.
- 320px dar ekranda profil menyusu, restoran siyahisi ve topbar birlikde yoxlanmalidir.
- Profil secenden sonra dropdown-un baglanmasi evvelki kimi qalmalidir.
