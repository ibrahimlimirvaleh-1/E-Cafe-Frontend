# Restoran əməliyyatlarında aktiv profil konteksti

Tarix: 2026-09-03

## Problem

Restoran siyahısında əməliyyat ikonlarına klik ediləndə istifadəçi restoran detail/edit səhifəsi əvəzinə dashboard-a yönləndirilə bilirdi.

Bu hal multi-restaurant və multi-role flow-da aktiv profilin açılacaq restoranla uyğun olmamasından yarana bilər. Route guard səhifəyə keçid zamanı cari aktiv profilə baxır; əgər həmin anda aktiv profil başqa restoran/rol kontekstindədirsə, frontend bunu icazəsiz keçid kimi qəbul edib istifadəçini ana admin səhifəsinə qaytarır.

## Dəyişikliklər

### `DataTable`

Fayl:

- `src/shared/ui/DataTable.tsx`

`onActionNavigate` optional callback əlavə edildi. Bu callback yalnız action ikonlarına klik ediləndə işləyir və komponentdən istifadə edən səhifəyə route keçidindən əvvəl kontekst hazırlamaq imkanı verir.

Callback verilməyən səhifələrdə davranış dəyişmir.

### `RestaurantManagementPage`

Fayl:

- `src/pages/admin/RestaurantManagementPage.tsx`

Restoran detail/edit əməliyyatından əvvəl `selectProfileForRestaurant(row.id)` çağırılır. Beləliklə istifadəçi həmin restorana bağlı profilə sahibdirsə, route guard işləməzdən əvvəl frontend aktiv konteksti həmin restorana uyğunlaşdırır.

## Təhlükəsizlik təsiri

Bu dəyişiklik backend icazələrini dəyişmir. Frontend yalnız aktiv UI kontekstini düzgün seçir. İstifadəçinin həmin restorana real icazəsi yoxdursa, backend yenə sorğunu rədd etməlidir.

## Performans təsiri

Əlavə API sorğusu yoxdur. Seçim mövcud auth state üzərindən edilir və localStorage-da aktiv profil açarı yenilənir.

## Yoxlama planı

1. Birdən çox restoran profili olan istifadəçi ilə login ol.
2. Restoran siyahısında başqa restorana aid göz ikonuna klik et.
3. Dashboard əvəzinə restoran detail səhifəsinin açıldığını yoxla.
4. Edit ikonuna klik et və redaktə səhifəsinə keçidin düzgün olduğunu yoxla.
5. İcazəsi olmayan restoran üçün backend-in hələ də sorğunu blokladığını yoxla.
