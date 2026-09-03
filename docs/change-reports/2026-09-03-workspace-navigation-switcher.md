# İş paneli və əsas səhifə keçidləri

Tarix: 2026-09-03

## Məqsəd

İstifadəçi admin, sahibkar, menecer, ofisiant və mətbəx kimi rollarla işlədikdə əsas səhifə ilə iş panelləri arasında rahat keçid etməlidir.

Əvvəl bu keçid açıq deyildi. Admin paneldə olan istifadəçi public restoran kataloquna rahat dönə bilmirdi, əsas səhifədə olan əməkdaş isə öz roluna uyğun panelə birbaşa keçid görmürdü.

## Dəyişikliklər

### `WorkspaceSwitcher`

Fayl:

- `src/shared/layout/WorkspaceSwitcher.tsx`

Yeni reusable keçid komponenti əlavə edildi.

Komponent iki rejimdə işləyir:

- `site`: əsas səhifədə rol/profil seçimli “İş panelinə keç” menyusu göstərir;
- `workspace`: admin/staff panellərdə “Əsas səhifə” keçidi göstərir.

Əgər istifadəçinin bir neçə restoran/rol profili varsa, əsas səhifədə dropdown açılır və istifadəçi istədiyi profil üzrə uyğun panelə keçir.

### Shell inteqrasiyası

Fayllar:

- `src/shared/layout/SiteShell.tsx`
- `src/shared/layout/AdminShell.tsx`
- `src/shared/layout/StaffShell.tsx`

Keçid komponenti hər shell-in topbar action hissəsinə əlavə edildi.

### Role route helper

Fayl:

- `src/shared/auth/authz.ts`

`getHomePathForRoleId` helper-i əlavə edildi. Bu helper konkret role görə doğru başlanğıc səhifəni qaytarır:

- Platform admin, sahibkar, menecer: `/admin`
- Ofisiant: `/waiter`
- Mətbəx: `/kitchen`

### Header profil dəyişimi

Fayllar:

- `src/shared/layout/UserMenu.tsx`
- `src/pages/customer/ProfilePage.tsx`
- `src/styles/globals.css`

Bir neçə giriş profili olan istifadəçilər üçün profil seçimi header-dəki hesab menyusuna əlavə edildi. İstifadəçi artıq Profil səhifəsinə keçmədən cari restoran/rol kontekstini dəyişə bilir.

Profil səhifəsində əvvəl olan “Bu profillə keç” əməliyyatı ləğv edildi və həmin blok yalnız cari giriş profilini göstərən məlumat kartına çevrildi. Bunun səbəbi eyni əməliyyatın iki fərqli yerdə təkrarlanmamasıdır. Profil səhifəsi profil məlumatları və sessiya təhlükəsizliyi üçün qalır, giriş konteksti isə qlobal header-dən idarə olunur.

## Təhlükəsizlik təsiri

Bu dəyişiklik backend icazələrini dəyişmir. Keçid yalnız istifadəçinin frontend auth state-ində olan aktiv profil və role görə route seçir. Real data qoruması yenə backend authorization ilə qalır.

## Performans təsiri

Əlavə API sorğusu yoxdur. Komponentlər mövcud `user.profiles` məlumatından istifadə edir. Profil dəyişəndə yalnız frontend auth state yenilənir və istifadəçi role uyğun başlanğıc route-a yönləndirilir.

## Yoxlama planı

1. Admin panelə daxil ol və topbar-da “Əsas səhifə” keçidini yoxla.
2. Əsas səhifəyə qayıt və “İş panelinə keç” düyməsini yoxla.
3. Bir neçə profilli istifadəçidə dropdown-dan fərqli restoran/rol seç.
4. Sahibkar/menecer seçəndə `/admin`, ofisiant seçəndə `/waiter`, mətbəx seçəndə `/kitchen` açıldığını yoxla.
5. Header-də aktiv rol/restoran məlumatının dəyişdiyini yoxla.
6. Bir neçə profilli istifadəçidə header-dəki hesab menyusunu aç və fərqli profilə keç.
7. Profil səhifəsində “Cari giriş profili” blokunun yalnız aktiv profili göstərdiyini yoxla.
