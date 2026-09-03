# 2026-09-03 - Tək restoran seçimi, bildiriş və profil davranışı düzəlişləri

## Məqsəd

Sahibkar, menecer, mətbəx, ofisiant kimi restoran kontekstli istifadəçilərdə adətən yalnız aktiv profilə bağlı bir restoran görünür. Bu halda səhifələrdə restoran select-i göstərmək artıq addım yaradır və istifadəçiyə lazımsız seçim hissi verir. Eyni zamanda resept səhifəsində menyu məhsulu yoxdursa boş select qalırdı, profil menyusu seçimdən sonra açıq qalırdı, bildiriş popover-i isə artıq API çağırışları ilə yavaş hiss olunurdu.

## Dəyişdirilən fayllar

- `src/shared/ui/RestaurantSelectField.tsx`
- `src/pages/admin/InventoryManagementPage.tsx`
- `src/shared/layout/UserMenu.tsx`
- `src/shared/layout/NotificationBell.tsx`
- `src/shared/auth/AuthContext.tsx`
- `src/shared/auth/jwt.ts`
- `src/styles/globals.css`
- `src/pages/admin/StaffManagementPage.tsx`
- `src/pages/admin/TablesManagementPage.tsx`
- `src/pages/admin/MenuManagementPage.tsx`

## Görülən işlər

### Tək restoran olduqda seçim ləğv edildi

`RestaurantSelectField` artıq yalnız bir restoran seçimi varsa dropdown açmır. Bunun əvəzinə read-only restoran konteksti göstərir. Bu, admin olmayan istifadəçilər üçün daha təmiz flow yaradır və uzun restoran adları ilə dropdown daşması riskini azaldır.

Personal, masalar və menyu idarəetməsi səhifələrində də eyni qayda tətbiq edildi. Səhifə URL-ində etibarlı `restaurantId` varsa həmin kontekst saxlanılır; yoxdursa və istifadəçinin yalnız bir əlçatan restoranı varsa həmin restoran avtomatik seçilir. Beləliklə tək restoranlı istifadəçi əlavə seçim görmür və siyahılar/formlar boş restaurant state-də ilişib qalmır.

### Menyu məhsulu boş olduqda mesaj göstərildi

Resept səhifəsində restoranın menyu məhsulu yoxdursa boş select göstərilmir. İstifadəçiyə resept yaratmaq üçün əvvəl menyu məhsulu yaratmalı olduğu aydın mesajla göstərilir. Boş “Resept ingredientləri” paneli də bu halda render olunmur.

### Profil dropdown seçimdən sonra bağlanır

Profil seçimi əvvəl `details` elementinin default davranışına bağlı idi və profil dəyişəndən sonra menyu açıq qalırdı. İndi açıq/bağlı state React tərəfindən idarə olunur. Profil seçiləndə, cari profilə kliklənəndə və profil məlumatlarına keçəndə popover avtomatik bağlanır.

### Profil avatarı profil dəyişəndə dəyişmir

Profil siyahısında restoran baş hərfi göstərildiyi üçün istifadəçi restoran dəyişəndə profil şəkli dəyişirmiş kimi görünürdü. İndi header və profil siyahısı istifadəçinin öz avatarını, avatar yoxdursa istifadəçi ad-soyad initial-larını göstərir. `fileUrl` auth state-də saxlanır və profil refresh zamanı qorunur.

Header-də profil pill-in içindəki avatar `span` elementi ümumi mətn `span` CSS qaydasını da götürürdü. Bu səbəbdən `EE` kimi iki hərfli initial-lar dairənin içində sıxılıb kəsilmiş görünürdü. Selector daraldıldı və mətn layout qaydası yalnız avatar olmayan `span`-ə tətbiq edildi. Avatarın özünə sabit `line-height` verildi ki, profil şəkli olmayan halda initial-lar mərkəzdə və oxunaqlı qalsın.

Sonrakı yoxlamada avatarın `span` kimi qalmasının gələcək CSS qaydaları ilə yenidən konflikt riski saxladığı göründü. Buna görə header və profil dropdown daxilində avatar wrapper-i `div` elementinə keçirildi, initial mətn isə ayrıca `.user-avatar-initials` elementi ilə göstərildi. Bu struktur avatarı mətn blokunun ümumi selector-larından ayırır və həm real profil şəkli, həm də initial fallback üçün sabit mərkəzləmə verir.

### Bildiriş popover-i yüngülləşdirildi

Bildirişlərdə eyni anda təkrarlanan list/count sorğularını azaltmaq üçün request id və local loaded state əlavə edildi. Popover açılışı mövcud məlumatla dərhal görünür, refresh isə fon rejimində işləyir. Aktiv profil dəyişəndə cache sıfırlanır və bildirişlər yeni restoran kontekstinə görə yenilənir.

## Biznes təsiri

- Restoran kontekstli istifadəçilər bir restoran olduqda lazımsız seçim görmür.
- Resept yaratmaq mümkün deyilsə səbəb aydın görünür.
- Profil dəyişmək daha təbii olur və əlavə klik tələb etmir.
- Bildirişlər daha sürətli hiss olunur və aktiv profilə uyğun yenilənir.
- Profil şəkli istifadəçi şəxsiyyətinə bağlı qalır, restoran dəyişəndə dəyişmir.

## Test tövsiyələri

1. Bir restoran profili olan sahibkarla daxil ol və resept, stok, personal kimi restoran seçimi olan səhifələrdə dropdown əvəzinə sabit restoran kontekstinin göründüyünü yoxla.
2. Birdən çox restoranı olan adminlə daxil ol və restoran seçiminin hələ də dropdown kimi işlədiyini yoxla.
3. Menyu məhsulu olmayan restoranda `Reseptlər` səhifəsinə keç və boş select yerinə mesajın çıxdığını yoxla.
4. Header-də profil seçimini aç, başqa profil seç və popover-in avtomatik bağlandığını yoxla.
5. Profil şəkli olan istifadəçidə profil dəyiş və avatarın restoran baş hərfinə dəyişmədiyini yoxla.
6. Bildiriş ikonuna ardıcıl bir neçə dəfə kliklə və popover-in donmadan açılıb bağlandığını yoxla.
