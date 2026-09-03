# Restoran kontekstli admin route icazəsi

Tarix: 2026-09-03

## Problem

Restoran siyahısında əməliyyat ikonuna klik etdikdə istifadəçi bəzən restoran detail/edit səhifəsi əvəzinə dashboard səhifəsinə yönləndirilirdi.

Əsas səbəb aktiv profil və route guard arasında timing fərqi idi. Action klikində aktiv profil dəyişdirilsə də, React state dərhal yenilənmədiyi üçün route guard bəzi hallarda köhnə aktiv profilə görə qərar verirdi.

## Dəyişikliklər

### Scoped permission yoxlaması

Fayllar:

- `src/shared/auth/authz.ts`
- `src/shared/config/adminPermissions.ts`

`restaurantId` olan admin route-larda permission artıq cari aktiv profilə yox, həmin restoran üzrə istifadəçinin real `restaurantId:roleId` assignment-inə görə yoxlanılır.

Bu daha düzgündür, çünki route authorization backend modelinə uyğun olaraq scoped olmalıdır. Aktiv profil isə UI kontekstidir.

### Route guard-da profil konteksti sinxronizasiyası

Fayl:

- `src/app/router.tsx`

Admin route-da `restaurantId` varsa və aktiv profil başqa restoranı göstərirsə, guard həmin restoranı aktiv profil kimi seçir. Bu UI header, menyu və növbəti əməliyyatların doğru kontekstdə görünməsinə kömək edir.

### Parent admin route

Fayl:

- `src/app/router.tsx`

`/admin` parent route artıq yalnız istifadəçinin login olub-olmadığını yoxlayır. Modul səviyyəsində rol və permission qərarı child guard-da verilir. Bu vacibdir, çünki istifadəçi bir profildə ofisiant, başqa restoranda sahibkar ola bilər; restoran-scoped səhifəyə birbaşa keçid zamanı parent route aktiv ofisiant profilinə görə child guard-a çatmadan redirect etməməlidir.

Dashboard üçün ayrıca `AdminDashboardEntry` saxlanıldı. Aktiv profil admin rol deyilsə, `/admin` index səhifəsi yenə uyğun home route-a qaytarır.

## Təhlükəsizlik təsiri

Bu dəyişiklik frontend-də icazəni zəiflətmir. Əksinə, restoran-scoped səhifələrdə qərar aktiv profilin gec yenilənməsinə yox, istifadəçinin həmin restoran üzrə real roluna əsaslanır.

Backend yenə əsas qoruma mənbəyidir və icazəsiz restoran datasını qaytarmamalıdır.

## Performans təsiri

Əlavə API sorğusu yoxdur. Yoxlama mövcud auth state-dəki `profiles` və `restaurantRoles` massivləri üzərindən aparılır.

## Yoxlama planı

1. Bir neçə restorana bağlı istifadəçi ilə login ol.
2. Restoran siyahısında göz ikonuna klik et.
3. Dashboard-a atmadan `/admin/restaurants/:restaurantId` səhifəsinin açıldığını yoxla.
4. Qələm ikonuna klik et.
5. İcazə varsa edit səhifəsinin açıldığını, icazə yoxdursa detail və ya home route-a yönləndiyini yoxla.
6. Header-də aktiv restoran/rol kontekstinin açılan səhifəyə uyğunlaşdığını yoxla.
