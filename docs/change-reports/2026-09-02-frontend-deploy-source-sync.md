# Frontend Dev Deploy Source Sync

## Məqsəd

`dev` branch-ə merge etdikdən sonra frontend deploy GitHub Actions mərhələsində qırılırdı. Səbəb serverin deploy zamanı `/opt/ecafe/frontend` içində `git fetch` / `git pull` etməsi idi. Repo private olduğu üçün Hetzner serverdə GitHub credential olmadıqda deploy aşağıdakı tip xəta ilə dayanırdı:

```text
fatal: could not read Username for 'https://github.com': No such device or address
```

## Edilən dəyişikliklər

### `.github/workflows/deploy-dev.yml`

- `actions/checkout@v4` əlavə edildi.
- Frontend source GitHub Actions runner-də `frontend-source.tar.gz` paketinə yığılır.
- `.git`, `node_modules`, `dist`, `.env`, `.env.*` paketə daxil edilmir.
- Paket `appleboy/scp-action` ilə serverə göndərilir.
- Serverdə `/opt/ecafe/frontend` paketin içindəki hazır source ilə yenilənir.
- Server artıq `git fetch`, `git checkout`, `git reset` və ya `git pull` etmir.
- Docker build və restart əvvəlki kimi serverdə `docker compose build frontend` və `docker compose up -d frontend` ilə işləyir.

### `CI_CD_FLOW.md`

- Deploy axını yeniləndi.
- Serverdə GitHub credential saxlanmamasının səbəbi sənədləşdirildi.

## Niyə belə edildi?

Best practice olaraq private repo olan layihələrdə deploy serverin GitHub-dan kod çəkməsi əvəzinə GitHub Actions-ın source-u hazırlayıb serverə göndərməsi daha stabildir.

Bu yanaşmanın üstünlükləri:

- Serverdə GitHub token və ya deploy key saxlamağa ehtiyac qalmır.
- Deploy GitHub credential problemindən asılı olmur.
- Server yalnız build və runtime mühitini idarə edir.
- GitHub Actions hansı commit-i deploy etdiyini dəqiq bilir.
- `node_modules`, `dist`, `.env` kimi lazımsız və həssas fayllar serverə paketlə göndərilmir.

## Təsir dairəsi

- Frontend runtime kodu dəyişməyib.
- UI, API inteqrasiyası və auth məntiqinə toxunulmayıb.
- Yalnız GitHub Actions dev deploy mexanizmi dəyişib.

## Risklər

- Serverdə `tar` komandası olmalıdır. Linux serverlərdə bu adətən mövcuddur.
- `ECAFE_DEV_PATH` secret-i boşdursa workflow `/opt/ecafe` default path istifadə edir.
- Serverdə `docker compose` və compose file əvvəlki kimi işlək qalmalıdır.

## Yoxlama

- Lokal frontend build ayrıca dəyişməyib, çünki runtime koduna toxunulmadı.
- Workflow YAML sintaksisi source paketləmə, upload və serverdə açma ardıcıllığına görə yeniləndi.

