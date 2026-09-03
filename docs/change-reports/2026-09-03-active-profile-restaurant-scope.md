# Aktiv profil restoran sərhədi

Tarix: 2026-09-03

## Problem

İstifadəçi bir neçə restorana bağlı olduqda, məsələn Buta Baku üçün sahibkar profilini seçsə də, Dolce Vita Port Baku məlumatlarını görə bilirdi. Bu biznes qaydasına uyğun deyil: yalnız platform admin bütün restoranları görə bilər, sahibkar/menecer/ofisiant/mətbəx isə yalnız aktiv profilində seçilən restoran kontekstində işləməlidir.

## Dəyişikliklər

### Aktiv profil storage helper-i

Fayl:

- `src/shared/auth/activeProfileStorage.ts`

Aktiv profilin local storage açarı və oxuma/yazma məntiqi ayrıca helper-ə çıxarıldı. Bunun səbəbi həm `AuthContext`, həm də API client-in eyni aktiv profil kontekstindən istifadə etməsidir.

### API sorğularına aktiv kontekst header-ləri

Fayl:

- `src/shared/api/httpClient.ts`

Hər authenticated API sorğusunda aşağıdakı header-lər göndərilir:

- `X-Active-Restaurant-Id`
- `X-Active-Role-Id`

Bu header-lər backend-ə istifadəçinin hazırda hansı restoran/rol profili ilə işlədiyini bildirir. Backend yenə token və permission ilə yoxlama aparmalıdır; frontend header-i təkbaşına təhlükəsizlik mənbəyi deyil.

### Frontend restoran filteri

Fayllar:

- `src/shared/auth/authz.ts`
- `src/pages/admin/RestaurantManagementPage.tsx`

`canAccessRestaurant` artıq qeyri-admin istifadəçidə bütün bağlı restoranlara yox, yalnız aktiv `user.restaurantId`-ə icazə verir. Restoran siyahısı səhifəsində də platform admin xaricində yalnız aktiv profil restoranı göstərilir.

## Təhlükəsizlik təsiri

Frontend artıq istifadəçiyə passiv bağlı olduğu digər restoranları göstərmir. Əsas təhlükəsizlik sərhədi backend-də olmalıdır; bu frontend dəyişiklikləri istifadəçi təcrübəsini və yanlış klikləri düzəldir.

## Performans təsiri

Əlavə API sorğusu yoxdur. Aktiv profil məlumatı mövcud token və local storage açarından oxunur.

## Yoxlama planı

1. İki restoran profili olan istifadəçi ilə daxil ol.
2. Header-dən Buta Baku sahibkar profilini seç.
3. Admin restoran səhifəsində yalnız Buta Baku göründüyünü yoxla.
4. Header-dən Dolce Vita profilinə keç.
5. Siyahı və restoran seçimlərinin yalnız Dolce Vita kontekstinə dəyişdiyini yoxla.
6. Platform admin ilə daxil olub bütün restoranların göründüyünü yoxla.
