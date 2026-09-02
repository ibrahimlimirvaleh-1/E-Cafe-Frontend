# Müqavilə bildirişində restoran context düzəlişi

Tarix: 2026-09-02

## Problem

Bir istifadəçi bir neçə restorana bağlı olduqda müqavilə bildirişinə klik edəndə frontend yalnız contract ID ilə `/admin/contracts/{contractId}` səhifəsinə gedirdi. Contract detail səhifəsi isə müqaviləni tapmaq üçün əvvəlcə restoran siyahısını çəkir, sonra həmin restoranların müqavilələrini axtarırdı.

Əgər istifadəçinin cari profil/context məlumatı başqa restorana bağlı görünürdüsə, bildirişin aid olduğu restoranın müqaviləsi tapılmaya bilərdi. Nəticədə istifadəçi "Müqavilə məlumatları yüklənir..." mesajında qalırdı və sistem istifadəçiyə nə etməli olduğunu izah etmirdi.

## Dəyişikliklər

### Shared notification target helper

Yeni helper əlavə edildi:

- `src/shared/notifications/notificationTarget.ts`

Bu helper notification payload-dan `restaurantId` və `contractId` oxuyur və contract bildirişi üçün URL-i belə qurur:

- `/admin/contracts/{contractId}?restaurantId={restaurantId}`

Bu məntiq həm yuxarı bildiriş dropdown-unda, həm də bildirişlər səhifəsində istifadə olunur.

### Duplicate route məntiqi silindi

Aşağıdakı fayllardakı təkrarlanan notification route kodu shared helper ilə əvəz edildi:

- `src/shared/layout/NotificationBell.tsx`
- `src/pages/customer/NotificationsPage.tsx`

Bu gələcəkdə eyni routing bug-ının iki fərqli yerdə təkrarlanmasının qarşısını alır.

### Contract detail query context istifadə edir

`src/pages/admin/contracts/ContractDetailPage.tsx` artıq URL-dəki `restaurantId` query parametrini oxuyur və contract-ı həmin restoran üzərindən axtarır.

Əvvəl:

- contract detail bütün əlçatan restoranları gəzirdi;
- səhv və ya natamam restoran siyahısında contract tapılmırdı.

İndi:

- bildirişdən gələndə konkret restoran ID ilə axtarır;
- performans daha yaxşıdır, çünki lazımsız restoran müqavilələri çəkilmir;
- contract tapılmayanda sonsuz loading göstərilmir.

### Tapılmadı vəziyyəti

Contract tapılmayanda artıq istifadəçiyə aydın mesaj göstərilir:

- müqavilə silinmiş ola bilər;
- hesabın həmin restorana icazəsi olmaya bilər;
- restoran icazələri yenilənməyibsə yenidən login tövsiyə edilir.

## Təhlükəsizlik təsiri

Frontend yalnız URL-də restoran ID göndərir. Real icazə backend-də qalır. Backend həmin restoran üzrə istifadəçinin icazəsini yoxlayır. İstifadəçi URL-də başqa restoran ID yazsa belə, backend icazə yoxlamasından keçmədiyi üçün məlumat qaytarılmamalıdır.

## Performans təsiri

Bildirişdən contract açılan zaman bütün restoranların müqavilələrini çəkmək əvəzinə konkret restoranın müqavilələri çəkilir. Bu, xüsusilə bir istifadəçinin çox restoranı olduqda request sayını azaldır.

## Yoxlama planı

1. İki restorana bağlı sahibkar hesabı ilə login ol.
2. İkinci restorana aid müqaviləni sahibkara təsdiq üçün göndər.
3. Bildiriş dropdown-undan həmin bildirişə kliklə.
4. URL-də `restaurantId` query parametrinin gəldiyini yoxla.
5. Contract detail səhifəsinin doğru müqaviləni açdığını yoxla.
6. Yanlış contract ID ilə səhifəyə gedib istifadəçiyə "Müqavilə tapılmadı" mesajının çıxdığını yoxla.

