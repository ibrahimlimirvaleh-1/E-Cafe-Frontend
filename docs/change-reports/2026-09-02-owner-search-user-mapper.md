# Sahibkar Axtarışı Üçün Frontend Mapper Düzəlişi

## Məqsəd

Restoran yaratma səhifəsində mövcud sahibkar email və ya telefonla axtarılanda bazada olan sahibkar göstərilmirdi. Səbəb frontend-in user response formatını tam düzgün oxumaması idi.

## Kök Səbəb

Frontend `mapUserProfile` funksiyasında rol məlumatını top-level `roleId` və `role` kimi gözləyirdi:

```text
roleId
role
```

Backend isə bəzi siyahılarda rol məlumatını nested obyekt kimi qaytara bilir:

```text
role: { id, name, isStaffAssignable }
```

Bu halda frontend `roleId`-ni `0`, `role`-u isə obyekt kimi yanlış oxuyurdu. Nəticədə `isOwnerProfile` sahibkarı tanımırdı və axtarış nəticəsi boş görünürdü.

## Edilən Dəyişiklik

### `src/shared/api/ecafeApi.ts`

`mapUserProfile` funksiyası həm yeni, həm də köhnə response formatlarını oxuyacaq formada yeniləndi:

- `roleId` əvvəl top-level `record.roleId`, yoxdursa nested `record.role.id`-dən götürülür.
- `role` əvvəl `roleName`, yoxdursa nested `role.name`, yoxdursa köhnə `record.role` dəyərindən götürülür.
- Email və telefon sahələri əvvəlki kimi top-level response-dan oxunur.

## Niyə Belə Daha Düzgündür?

- Frontend backend response formatındakı kiçik fərqlərə qarşı daha dayanıqlı olur.
- Mövcud sahibkar axtarışı `roleId = 2` istifadəçiləri düzgün tanıyır.
- UI dəyişmir, yalnız data mapping düzəlir.
- Gələcəkdə backend `roleName` və ya nested `role` formatından hansını qaytarsa, frontend işləməyə davam edir.

## Təsir Dairəsi

- Restoran yaratma səhifəsində mövcud sahibkar axtarışı düzəlir.
- Profil və digər user list mapping-ləri daha stabil olur.
- Visual dizayna toxunulmayıb.

