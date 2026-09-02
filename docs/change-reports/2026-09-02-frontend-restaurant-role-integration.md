# Frontend restoran-rol inteqrasiyasi hesabatı

Tarix: 2026-09-02
Branch: `feature/profile-session-management`

## Məqsəd

Backend-də istifadəçinin bir neçə restoranda fərqli rol ilə işləməsi məntiqi hazırlandığı üçün frontend-in köhnə `bir user = bir role + bir restaurantId` fərziyyəsi yeniləndi. Məqsəd istifadəçiyə yalnız icazəsi olan restoranları göstərmək, restoran konteksti olan admin səhifələrində yanlış `restaurantId` ilə sorğu göndərməmək və bildiriş linklərini həmin restoran üzrə icazəyə görə qurmaqdır.

## Dəyişən əsas fayllar

- `src/shared/auth/jwt.ts`
  - JWT içindən `restaurantIds` və `restaurantRoles` claim-ləri oxunur.
  - `restaurantRoles` formatı `restaurantId:roleId` kimi parse edilir.
  - Köhnə `restaurantId` claim-i fallback olaraq saxlanıldı ki, əvvəlki tokenlər də işləsin.

- `src/shared/auth/authz.ts`
  - Rol yoxlaması restoran kontekstinə uyğunlaşdırıldı.
  - `getRestaurantRoleId`, `getRoleIds`, `canAccessRestaurant`, `getAccessibleItems`, `isPlatformAdmin` helper-ləri əlavə edildi.
  - `getHomePathForUser` admin rolu olan çox-rol istifadəçiləri admin panelə yönləndirəcək formada yeniləndi.

- `src/shared/config/adminPermissions.ts`
  - `canAccessAdminModule` artıq istəyə bağlı `restaurantId` qəbul edir.
  - Konkret restoran route-larında istifadəçinin həmin restorana çıxışı yoxlanır.

- `src/app/router.tsx`
  - Admin route guard `restaurantId` parametrini oxuyub modul icazəsini həmin restoran kontekstində yoxlayır.

- `src/shared/ui/RestaurantSelectField.tsx`
  - Restoran seçim komponenti istifadəçinin çıxışı olmayan restoranları siyahıda göstərmir.
  - Əgər URL və ya köhnə state icazəsiz restoran id saxlayıbsa, seçim təmizlənir.

- `src/pages/admin/MenuManagementPage.tsx`
  - Menyu və kateqoriya əməliyyatlarında seçilən restoran icazəli restoran siyahısından götürülür.
  - Yanlış URL `restaurantId` ilə menyu/kateqoriya sorğusu göndərilməsinin qarşısı alındı.

- `src/pages/admin/StaffManagementPage.tsx`
  - Personal siyahısı, yaratma və redaktə əməliyyatlarında restoran seçimi icazəli siyahıya salındı.

- `src/pages/admin/TablesManagementPage.tsx`
  - Masa siyahısı, yaratma, redaktə və kopyalama axınlarında restoran konteksti icazəli siyahıdan gəlir.

- `src/pages/admin/InventoryManagementPage.tsx`
  - Stok, stok hərəkətləri və resept səhifələrində avtomatik seçilən restoran yalnız icazəli siyahıdan seçilir.

- `src/pages/admin/AuditLogPage.tsx`
  - Audit log üçün ilk restoran seçimi və dropdown yalnız icazəli restoranlara əsaslanır.

- `src/shared/layout/NotificationBell.tsx`
- `src/pages/customer/NotificationsPage.tsx`
  - Bildirişdən admin səhifəsinə keçid restoran id varsa həmin restoran üzrə icazə ilə yoxlanır.

## Təhlükəsizlik qeydi

Frontend dəyişiklikləri UX və yanlış sorğuların azaldılması üçündür. Əsas təhlükəsizlik backend-də qalır: istifadəçi URL-i əl ilə dəyişsə belə server restoran üzrə rol və müqavilə aktivliyini yoxlamalıdır.

## Performans qeydi

Restoran filtrasiya işi frontend-də artıq yüklənmiş restoran siyahısı üzərində `useMemo` ilə aparılır. Əlavə backend sorğusu yaradılmadı.

## Yoxlama

- `npm run build` uğurla tamamlandı.
- `git diff --check` uğurla tamamlandı.
- Vite build zamanı yalnız mövcud böyük chunk xəbərdarlığı çıxdı; bu deployu bloklayan xəta deyil.
