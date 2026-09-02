# Frontend Deploy Package Temp Fix

## Məqsəd

`dev` deploy workflow-u `Package frontend source` addımında dayanırdı. Bu addım serverə çatmadan, GitHub Actions runner daxilində qırıldığı üçün problem SSH və ya Docker mərhələsində deyildi.

## Səbəb

Əvvəlki workflow arxivi repo qovluğunun içində yaradırdı:

```text
frontend-source.tar.gz
```

`tar` komandası source qovluğunu paketləyərkən həmin qovluğun içində yeni arxiv faylı da yaranırdı. Bu vəziyyətdə `tar` öz yaratdığı faylı da oxumağa çalışa və package mərhələsini fail edə bilər.

## Edilən dəyişiklik

### `.github/workflows/deploy-dev.yml`

- Arxiv artıq repo qovluğunda yox, GitHub Actions runner temp qovluğunda yaradılır:

```text
$RUNNER_TEMP/frontend-source.tar.gz
```

- Arxiv yaradıldıqdan sonra workspace root-a kopyalanır və upload addımı relative path ilə həmin faylı serverə göndərir:

```text
frontend-source.tar.gz
```

Bu, `scp-action` üçün path mapping davranışını daha sadə və stabil saxlayır.

## Niyə belə daha düzgündür?

- Repo source qovluğu build artifact ilə qarışmır.
- `tar` öz yaratdığı arxivi paketə salmağa çalışmır.
- Workflow daha deterministik işləyir.
- Local source təmiz qalır və deploy paketi yalnız CI temp sahəsində yaşayır.

## Təsir dairəsi

- Frontend tətbiq koduna toxunulmayıb.
- UI, API, auth və biznes məntiq dəyişməyib.
- Yalnız GitHub Actions deploy paketləmə addımı düzəldilib.

## Yoxlama

- `git diff --check` ilə whitespace/sintaksis səviyyəsində yoxlanmalıdır.
- Merge-dən sonra `Deploy Frontend Dev` workflow-u `Package frontend source` mərhələsini keçməlidir.
