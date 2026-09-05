# Restoran qrupu email təkrar xəbərdarlığı

## Məqsəd

Restoran qrupu emaili login emaili deyil, biznes əlaqə emailidir. Buna görə eyni emailin bir neçə qrupda istifadəsi real biznes hallarında mümkün olmalıdır. Amma ayrı brendlərin təsadüfən eyni emailə bağlanması müqavilə, bildiriş və rəsmi yazışma qarışıqlığı yarada bilər.

Bu dəyişiklikdə email təkrarı bloklanmadı, sadəcə adminə yumşaq xəbərdarlıq göstərildi.

## Dəyişən kodlar

- `src/pages/admin/RestaurantManagementPage.tsx`
  - Yeni restoran yaradılarkən yeni qrup emaili mövcud qrupların emaili ilə müqayisə olunur.
  - Eyni email tapılarsa formanın içində xəbərdarlıq göstərilir.
  - Xəbərdarlıq submit-i bloklamır; admin doğru qərardırsa davam edə bilir.
  - “Qrup əlaqə emaili” sahəsi 2 sütunlu grid içində tam eni tutur ki, sağ tərəfdə boş və yarımçıq görünüş qalmasın.

- `src/pages/admin/RestaurantGroupsPage.tsx`
  - Birbaşa restoran qrupu yaradılarkən də eyni email yoxlanılır.
  - Təkrar email varsa hansı qruplarda istifadə olunduğu göstərilir.

- `src/styles/globals.css`
  - `form-grid-full` əlavə edildi və tək sahənin grid-də tam eni tutması təmin edildi.
  - `soft-warning-panel` əlavə edildi: xəbərdarlıq sakit rəngdə, oxunaqlı və responsive formada göstərilir.

## UX nəticəsi

- Admin səhvən iki ayrı biznes qrupuna eyni email yazanda bunu dərhal görür.
- Eyni sahibkar və ya eyni hüquqi şirkət bir neçə qrupu eyni emaildən idarə edirsə sistem buna mane olmur.
- Restoran yaratma formasında email sahəsi çıxdıqda boş sağ sütun effekti aradan qalxır.

## Biznes məntiqi

Ən yaxşı yanaşma budur:

- `User.Email` unique qalmalıdır, çünki login identifikatorudur.
- `RestaurantGroup.Email` unique olmamalıdır, çünki əlaqə kanalıdır.
- Təkrar qrup emaili bloklanmamalıdır, amma admin xəbərdar edilməlidir.

