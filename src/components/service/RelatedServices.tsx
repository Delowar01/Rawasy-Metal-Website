import { ServiceCard, type ServiceCardData } from "@/components/cards/ServiceCard";
import { cn } from "@/lib/utils";

/** Services that commonly work with this one, as linked cards in their own tones. */
export function RelatedServices({ services, action }: { services: ServiceCardData[]; action: string }) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2", services.length > 2 ? "lg:grid-cols-3" : "lg:max-w-[56rem]")}>
      {services.map((service, i) => (
        <li key={service.slug}>
          <ServiceCard service={service} action={action} delay={i * 80} />
        </li>
      ))}
    </ul>
  );
}
