
import ImageLogo from '@/assets/logo.png';
import { useLanguage } from '@/shared/providers/language-provider';

/**
 * AboutSettings — Web 版精简"关于"
 *
 * 只保留：产品标识、版本/构建号、版权与许可证。
 * 不再展示自动更新、外部链接、桌面端脚注等 Web 不成立的内容。
 */
export function AboutSettings() {
  const { t } = useLanguage();
  const version = __APP_VERSION__;

  return (
    <div className="space-y-6">
      {/* Product Identity */}
      <div className="flex items-center gap-4">
        <img src={ImageLogo} alt="Sage" className="size-16 rounded-xl" />
        <div>
          <h2 className="text-foreground text-xl font-bold">Sage</h2>
          <p className="text-muted-foreground text-sm">
            {t.settings.tagline}
          </p>
        </div>
      </div>

      {/* Version & Build */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border-border bg-muted/20 rounded-lg border p-4">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {t.settings.version}
          </p>
          <p className="text-foreground mt-1 text-lg font-semibold">
            {version}
          </p>
        </div>
        <div className="border-border bg-muted/20 rounded-lg border p-4">
          <p className="text-muted-foreground text-xs tracking-wider uppercase">
            {t.settings.build}
          </p>
          <p className="text-foreground mt-1 text-lg font-semibold">
            {__BUILD_DATE__}
          </p>
        </div>
      </div>

      {/* Copyright & License */}
      <div className="space-y-3">
        <div className="border-border flex items-center justify-between rounded-lg border p-3">
          <span className="text-muted-foreground text-sm">
            {t.settings.copyright}
          </span>
          <span className="text-foreground text-sm font-medium">
            © 2026 Sage
          </span>
        </div>
        <div className="border-border flex items-center justify-between rounded-lg border p-3">
          <span className="text-muted-foreground text-sm">
            {t.settings.license}
          </span>
          <span className="text-foreground text-sm font-medium">
            Sage Community License
          </span>
        </div>
      </div>
    </div>
  );
}
