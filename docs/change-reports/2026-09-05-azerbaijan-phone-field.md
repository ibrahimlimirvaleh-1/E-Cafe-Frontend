# Azərbaycan telefon input standartı

## Məqsəd

Telefon sahələrində istifadəçi əvvəl `+994501234567`, `0501234567` və ya boşluqlu formatları əl ilə yazmalı idi. Bu həm səhv format riskini artırırdı, həm də admin formalarında vizual olaraq ağır görünürdü.

Bu dəyişiklikdə telefon daxil etmə forması daha rahat UX-ə keçirildi:

- `+994` ölkə kodu sabit göstərilir.
- Operator kodu seçim kimi verilir.
- İstifadəçi yalnız qalan 7 rəqəmi yazır.

Backend-ə göndərilən dəyər əvvəlki kimi tam formada qalır: `+994501234567`.

## Dəyişən kodlar

- `src/shared/ui/PhoneField.tsx`
  - Yeni reusable telefon komponenti yaradıldı.
  - Operator kodları: `50`, `51`, `55`, `70`, `77`, `99`, `10`, `60`.
  - Mövcud `+994...` və `0...` formatlı dəyərləri parse edib UI-da uyğun operator və 7 rəqəm kimi göstərir.
  - Dəyişiklik olanda parent formaya yenə tam `+994` formatlı telefon qaytarır.

- `src/pages/auth/AuthPage.tsx`
  - Qeydiyyat telefon sahəsi `PhoneField` komponentinə keçirildi.
  - Validasiya mesajı yeni UI məntiqinə uyğunlaşdırıldı.

- `src/pages/customer/ProfilePage.tsx`
  - Profil telefon sahəsi `PhoneField` komponentinə keçirildi.

- `src/pages/admin/RestaurantManagementPage.tsx`
  - Yeni restoran filial telefonu `PhoneField` komponentinə keçirildi.
  - Yeni sahibkar telefonu `PhoneField` komponentinə keçirildi.

- `src/pages/admin/RestaurantEditPage.tsx`
  - Restoran redaktə telefon sahəsi `PhoneField` komponentinə keçirildi.

- `src/pages/admin/StaffManagementPage.tsx`
  - Personal yaratma/redaktə telefon sahəsi `PhoneField` komponentinə keçirildi.
  - Form guidance və validasiya mesajı yeni formata uyğunlaşdırıldı.

- `src/styles/globals.css`
  - Telefon inputu üçün ölkə kodu, operator seçimi və nömrə inputundan ibarət responsive layout əlavə edildi.
  - Hover, focus və error state-ləri mövcud form field dizaynına uyğunlaşdırıldı.
  - Telefon control-u vizual olaraq yeniləndi: ayrı-ayrı boz bloklar əvəzinə tək ağ input səthi, incə ayrıcılar və səliqəli operator seçimi istifadə olunur.

## Son dizayn düzəlişi

İlk versiyada `+994`, operator select-i və nömrə inputu vizual olaraq ayrı boz qutular kimi görünürdü. Bu, formanın ümumi premium/admin dizaynına uyğun deyildi.

Yenilənmiş versiyada:

- `+994` sakit prefix kimi göstərilir.
- Operator seçimi ayrıca sərt qutu kimi yox, input daxilində segment kimi görünür.
- Native select oxu əvəzinə səliqəli ikon istifadə olunur.
- Control ağ fonda, incə border və focus state ilə göstərilir.
- Telefon sahəsi bütün formalarda eyni ölçü və ritmdə qalır.

## UX nəticəsi

- Telefon nömrəsi daxil etmək daha sürətli və aydındır.
- Səhv format yazmaq ehtimalı azalır.
- Backend kontraktı dəyişmir, yəni mövcud API axını qorunur.
- Admin və müştəri formalarında telefon sahəsi vahid dizaynla görünür.

## Yoxlanılmalı hallar

- Register zamanı telefon `+994501234567` kimi göndərilməlidir.
- Restoran yaradanda filial telefonu düzgün göndərilməlidir.
- Yeni sahibkar yaradanda sahibkar telefonu düzgün göndərilməlidir.
- Personal yaradanda və redaktə edəndə telefon düzgün göndərilməlidir.
- Profil yeniləyəndə telefon düzgün saxlanmalıdır.
