# 2026-09-04 - Tablet ölçüdə admin sidebar hündürlüyü düzəlişi

## Məqsəd

Tablet ölçüdə admin paneldə böyük boş sahə yaranırdı. Səhifə kontenti topbarın dərhal altından başlamalı olduğu halda, sidebar horizontal bara çevrildikdən sonra da tam viewport hündürlüyü saxlayırdı və əsas kontenti aşağı itələyirdi.

## Dəyişdirilən fayllar

- `src/styles/globals.css`

## Səbəb

Faylın sonunda olan ümumi responsive düzəliş blokunda `.admin-sidebar` üçün `min-height: 100dvh` tətbiq olunurdu. Bu desktop sidebar üçün məntiqlidir, çünki sol naviqasiya tam ekran boyu qalmalıdır.

Amma `1080px` və daha aşağı ölçülərdə layout dəyişir:

- `.admin-shell` block layout-a keçir;
- `.admin-sidebar` yuxarıda horizontal naviqasiya kimi görünür;
- əsas content sidebarın altında render olunur.

Bu halda `min-height: 100dvh` qalanda yuxarı sidebar bir ekran hündürlüyündə yer tutur və səhifə kontenti çox aşağı düşür.

## Görülən iş

`max-width: 1080px` breakpoint-i üçün `.admin-sidebar` davranışı yeniləndi:

- `min-height: auto`;
- `overflow: visible`.

Bu qayda tablet ölçülərdə sidebarın yalnız öz kontenti qədər hündür olmasını təmin edir. Desktopda isə əvvəlki tam hündür sidebar davranışı saxlanılır.

## Biznes təsiri

- Tablet görünüşdə böyük boş sahə aradan qalxır.
- Admin səhifələri topbar və naviqasiyadan sonra dərhal görünür.
- Desktop sidebar davranışı pozulmur.
- Mobil ölçülərdə əvvəlki horizontal scroll naviqasiya qaydası qorunur.

## Test tövsiyələri

1. Chrome responsive mode-da `768px` en seç və admin restoranlar səhifəsini aç.
2. Sidebar/nav hissəsinin tam ekran hündürlüyü tutmadığını yoxla.
3. `Restoranlar` başlığının topbarın dərhal altında başladığını yoxla.
4. Desktop ölçüdə sol sidebarın tam hündür qaldığını yoxla.
