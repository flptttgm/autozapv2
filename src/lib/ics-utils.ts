import { format } from "date-fns";

interface ICSAppointment {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  leads?: {
    name: string | null;
    phone: string;
  } | null;
}

const formatICSDate = (dateString: string): string => {
  const date = new Date(dateString);
  return format(date, "yyyyMMdd'T'HHmmss");
};

const escapeICSText = (text: string): string => {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
};

export const generateICSContent = (appointments: ICSAppointment[]): string => {
  const events = appointments.map((apt) => {
    const description = [
      apt.description,
      apt.leads ? `Cliente: ${apt.leads.name || apt.leads.phone}` : null,
    ]
      .filter(Boolean)
      .join("\\n");

    return `BEGIN:VEVENT
UID:${apt.id}@autozap.app
DTSTAMP:${formatICSDate(new Date().toISOString())}
DTSTART:${formatICSDate(apt.start_time)}
DTEND:${formatICSDate(apt.end_time)}
SUMMARY:${escapeICSText(apt.title)}
${description ? `DESCRIPTION:${escapeICSText(description)}` : ""}
END:VEVENT`;
  });

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Autozap//Agendamentos//PT
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Autozap Agendamentos
${events.join("\n")}
END:VCALENDAR`;
};

export const downloadICS = (appointments: ICSAppointment[], filename: string = "agendamentos") => {
  const content = generateICSContent(appointments);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
