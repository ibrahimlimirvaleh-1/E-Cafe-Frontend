# Mobile restaurant card deposit and CTA polish

## Deyisikliklerin xulasesi

- Public restoran kataloqunda depozit metni kart body-sinden cixarildi ve sekil uzerinde rating badge-i ile eyni vizual sistemde gosterildi.
- Depozit ucun `CircleDollarSign` ikonlu yeni overlay badge elave olundu.
- Kartin altindaki CTA duymesi silindi.
- Restoran sekli ve restoran adi restoran detal sehifesine kecid eden link kimi quruldu.
- Mobil ekranlarda restoran kartlarinin font olculeri bir qeder kicildildi.
- 480px ve daha dar ekranlarda sehifenin sag-sol mesafesi artirildi ki, kartlar ekran kenarlarina yapismasin.
- Mobil restoran kartlarinda grid setirleri depozit metninin silinmesine uygun yeniden balanslasdirildi.

## Toxunulan fayllar

- `src/pages/customer/RestaurantCatalogPage.tsx`
- `src/styles/globals.css`

## UX neticesi

- Depozit artiq reyting kimi tez oxunan vizual melumatdir.
- Kart body-si daha az six ve daha pesekar gorunur.
- Dar telefon ekranlarinda kartlarin kenar mesafesi daha rahat olur.
- Kart daha sakit ve mobil kataloga uygun gorunur.
- Istifadeci restoran sehifesine sekle ve ya ada klik ederek kecir.

## Test qeydləri

- Public restoran kataloqu mobil genisliklerde yoxlanmalidir: 320px, 375px, 390px.
- Restoran sekline klik etdikde detal sehifesine kecid yoxlanmalidir.
- Restoran adina klik etdikde detal sehifesine kecid yoxlanmalidir.
- Unvan setrine klik etdikde evvelki kimi xerite modalinin acilmasi yoxlanmalidir.
- Depozit badge-in uzun reqemlerde overlay-den dasmamasina baxilmalidir.
