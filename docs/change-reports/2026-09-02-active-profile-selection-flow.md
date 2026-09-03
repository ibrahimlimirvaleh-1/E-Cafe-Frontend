# Aktiv giriş profili seçimi

Tarix: 2026-09-02

## Problem

Bir istifadəçinin fərqli restoranlarda fərqli rolları ola bilər. Məsələn:

- Dolce Vita Port Baku üzrə `Sahibkar`
- Buta Baku üzrə `Menecer`

Əvvəl frontend istifadəçini daha çox tək rol/tək restoran kimi göstərirdi. Bu halda istifadəçi hansı restoran və rol kontekstində işlədiyini aydın görmürdü. Bildirişdən müqaviləyə keçəndə də yanlış aktiv context istifadəçini çaşdıra bilirdi.

## Dəyişikliklər

### Aktiv profil modeli

Fayllar:

- `src/shared/auth/jwt.ts`
- `src/shared/auth/AuthContext.tsx`
- `src/entities/types.ts`

`CurrentUser` modelinə `profiles` əlavə edildi. Aktiv profil frontend state-də `roleId`, `roleName` və `restaurantId` kimi saxlanılır. Bu seçim access token-i dəyişmir; token backend security üçün bütün icazəli restoran-rol cütlərini daşımağa davam edir.

### Login sonrası seçim modalı

Fayl:

- `src/shared/auth/AuthContext.tsx`

Əgər istifadəçinin birdən çox profili varsa və bu cihazda daha əvvəl aktiv seçim edilməyibsə, login-dən sonra modal çıxır:

- istifadəçi hansı restoran/rol ilə davam edəcəyini seçir;
- seçilən profil localStorage-da saxlanılır;
- UI həmin profilə uyğun route-a yönləndirilir.

Tək profilli istifadəçidə modal çıxmır.

### Profil səhifəsində giriş profilləri

Fayl:

- `src/pages/customer/ProfilePage.tsx`

Tək `Cari rol / Restoran` görünüşü əvəzinə bütün giriş profilləri göstərilir. İstifadəçi profil səhifəsindən aktiv profili dəyişə bilir.

### Header məlumatı

Fayl:

- `src/shared/layout/UserMenu.tsx`

Header-də istifadəçinin aktiv rolu ilə yanaşı aktiv restoran adı da görünür.

### Notification context

Fayllar:

- `src/shared/layout/NotificationBell.tsx`
- `src/pages/customer/NotificationsPage.tsx`

Bildirişdən restoran-scoped səhifəyə keçid zamanı frontend həmin `restaurantId` üçün profili avtomatik aktivləşdirir. İstifadəçiyə ayrıca "profili dəyiş" deməyə ehtiyac qalmır.

### Frontend permission hesablaması

Fayl:

- `src/shared/auth/authz.ts`

Ümumi UI permission və role check-lər artıq seçilmiş aktiv profilə görə işləyir. Explicit `restaurantId` gələndə isə həmin restoran üzrə token-dəki rol istifadə olunur.

## Təhlükəsizlik təsiri

Frontend aktiv profil seçimi yalnız UI context-dir. Backend bütün real icazələri yenə JWT `restaurantRoles` və route `restaurantId` əsasında yoxlayır. İstifadəçi localStorage-da profil seçimini dəyişsə belə, backend icazəsi olmayan restoran datasını qaytarmamalıdır.

## Performans təsiri

Seçilmiş profil localStorage-da saxlandığı üçün hər səhifə keçidində əlavə seçim endpoint-i çağırılmır. Profil detalları `/profile` response-dan alınır və mövcud session reconcile mexanizmi ilə yenilənir.

## Yoxlama planı

1. Bir profilli istifadəçi ilə login ol: modal çıxmamalıdır.
2. İki və daha çox profilli istifadəçi ilə login ol: seçim modalı çıxmalıdır.
3. `Sahibkar` profili seç: admin/contract UI görünməlidir.
4. `Menecer` profili seç: menecerə uyğun admin menyular görünməlidir.
5. `Ofisiant` profili seç: waiter panelinə yönlənməlidir.
6. Contract notification-a kliklə: frontend avtomatik həmin restoran profilini seçib contract detail açmalıdır.
7. Header-də aktiv rol və restoran adının dəyişdiyini yoxla.

