# 2026-09-03 - Bildirişlərin aktiv profil dəyişəndə yenilənməsi

## Məqsəd

Backend app daxili bildirişləri aktiv restoran kontekstinə görə süzdüyü üçün frontend də profil dəyişəndə bildiriş siyahısını və oxunmamış bildiriş sayını yenidən yükləməlidir.

## Dəyişdirilən fayllar

- `src/shared/layout/NotificationBell.tsx`
- `src/pages/customer/NotificationsPage.tsx`

## Görülən işlər

### Notification bell aktiv profilə bağlandı

Header-dəki bildiriş düyməsi artıq `restaurantId:roleId` dəyişəndə yenidən API çağırışı edir. Beləliklə istifadəçi Buta Baku profilindən Dolce Vita Port Baku profilinə keçəndə köhnə restoranın oxunmamış sayı ekranda ilişib qalmır.

### Bildiriş səhifəsi aktiv profilə bağlandı

`/notifications` səhifəsi də aktiv profil dəyişəndə siyahını yenidən yükləyir. Bu, səhifə açıq qalarkən profil dəyişildiyi hallarda yanlış restoran bildirişlərinin görünməsinin qarşısını alır.

## Biznes təsiri

- İstifadəçi hansı restoran profili ilə işləyirsə, bildirişlər də həmin profili izləyir.
- Müxtəlif restoranlara aid müqavilə və əməliyyat bildirişləri UI-da qarışmır.
- Header-dəki unread count backend ilə eyni scope-da qalır.

## Test tövsiyələri

1. İki restoran profili olan istifadəçi ilə login ol.
2. Bir restoran profilində bildiriş bell-ini aç.
3. Header-dən digər profilə keç.
4. Bell unread count və siyahının yeni profilə görə dəyişdiyini yoxla.
5. `/notifications` səhifəsində profil dəyişəndə siyahının reload olmasını yoxla.
