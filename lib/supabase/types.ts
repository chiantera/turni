// Generato da Supabase. Per rigenerare dopo una migrazione:
//   MCP supabase -> generate_typescript_types (project_id uxwmletpnmsbvdyxktln)
// Non modificare a mano.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          al: string
          creato_il: string
          dal: string
          giornata_intera: boolean
          id: string
          note: string | null
          shift_type_id: string | null
          tipo: Database["public"]["Enums"]["tipo_assenza"]
          worker_id: string
        }
        Insert: {
          al: string
          creato_il?: string
          dal: string
          giornata_intera?: boolean
          id?: string
          note?: string | null
          shift_type_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_assenza"]
          worker_id: string
        }
        Update: {
          al?: string
          creato_il?: string
          dal?: string
          giornata_intera?: boolean
          id?: string
          note?: string | null
          shift_type_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_assenza"]
          worker_id?: string
        }
        Relationships: []
      }
      ai_interactions: {
        Row: {
          accettato: boolean
          creato_il: string
          errore: string | null
          id: string
          latenza_ms: number | null
          modello: string | null
          provider: string | null
          risposta: Json | null
          testo: string
          token_input: number | null
          token_output: number | null
        }
        Insert: {
          accettato?: boolean
          creato_il?: string
          errore?: string | null
          id?: string
          latenza_ms?: number | null
          modello?: string | null
          provider?: string | null
          risposta?: Json | null
          testo: string
          token_input?: number | null
          token_output?: number | null
        }
        Update: {
          accettato?: boolean
          creato_il?: string
          errore?: string | null
          id?: string
          latenza_ms?: number | null
          modello?: string | null
          provider?: string | null
          risposta?: Json | null
          testo?: string
          token_input?: number | null
          token_output?: number | null
        }
        Relationships: []
      }
      assignments: {
        Row: {
          bloccato: boolean
          data: string
          id: string
          origine: Database["public"]["Enums"]["origine_assegnazione"]
          position_id: string
          schedule_id: string
          shift_type_id: string
          worker_id: string
        }
        Insert: {
          bloccato?: boolean
          data: string
          id?: string
          origine?: Database["public"]["Enums"]["origine_assegnazione"]
          position_id: string
          schedule_id: string
          shift_type_id: string
          worker_id: string
        }
        Update: {
          bloccato?: boolean
          data?: string
          id?: string
          origine?: Database["public"]["Enums"]["origine_assegnazione"]
          position_id?: string
          schedule_id?: string
          shift_type_id?: string
          worker_id?: string
        }
        Relationships: []
      }
      constraints: {
        Row: {
          attivo: boolean
          creato_il: string
          descrizione: string
          id: string
          is_hard: boolean
          kind: string
          origine: Database["public"]["Enums"]["origine_vincolo"]
          params: Json
          peso: number
          testo_originale: string | null
          valido_al: string | null
          valido_dal: string | null
        }
        Insert: {
          attivo?: boolean
          creato_il?: string
          descrizione: string
          id?: string
          is_hard?: boolean
          kind: string
          origine?: Database["public"]["Enums"]["origine_vincolo"]
          params?: Json
          peso?: number
          testo_originale?: string | null
          valido_al?: string | null
          valido_dal?: string | null
        }
        Update: {
          attivo?: boolean
          creato_il?: string
          descrizione?: string
          id?: string
          is_hard?: boolean
          kind?: string
          origine?: Database["public"]["Enums"]["origine_vincolo"]
          params?: Json
          peso?: number
          testo_originale?: string | null
          valido_al?: string | null
          valido_dal?: string | null
        }
        Relationships: []
      }
      coverage_rules: {
        Row: {
          giorno_settimana: number | null
          id: string
          n_richiesti: number
          position_id: string
          shift_type_id: string
          tipo_giorno: Database["public"]["Enums"]["tipo_giorno"]
          valido_al: string | null
          valido_dal: string | null
        }
        Insert: {
          giorno_settimana?: number | null
          id?: string
          n_richiesti?: number
          position_id: string
          shift_type_id: string
          tipo_giorno?: Database["public"]["Enums"]["tipo_giorno"]
          valido_al?: string | null
          valido_dal?: string | null
        }
        Update: {
          giorno_settimana?: number | null
          id?: string
          n_richiesti?: number
          position_id?: string
          shift_type_id?: string
          tipo_giorno?: Database["public"]["Enums"]["tipo_giorno"]
          valido_al?: string | null
          valido_dal?: string | null
        }
        Relationships: []
      }
      holidays: {
        Row: {
          data: string
          nazionale: boolean
          nome: string
          usa_copertura_festiva: boolean
        }
        Insert: {
          data: string
          nazionale?: boolean
          nome: string
          usa_copertura_festiva?: boolean
        }
        Update: {
          data?: string
          nazionale?: boolean
          nome?: string
          usa_copertura_festiva?: boolean
        }
        Relationships: []
      }
      positions: {
        Row: {
          attiva: boolean
          colore: string
          creato_il: string
          descrizione: string | null
          id: string
          nome: string
          ordine: number
        }
        Insert: {
          attiva?: boolean
          colore?: string
          creato_il?: string
          descrizione?: string | null
          id?: string
          nome: string
          ordine?: number
        }
        Update: {
          attiva?: boolean
          colore?: string
          creato_il?: string
          descrizione?: string | null
          id?: string
          nome?: string
          ordine?: number
        }
        Relationships: []
      }
      planning_runs: {
        Row: {
          al: string
          aggiornato_il: string
          creato_il: string
          dal: string
          id: string
          stato: Database["public"]["Enums"]["stato_piano"]
          versione: number
        }
        Insert: {
          al: string
          aggiornato_il?: string
          creato_il?: string
          dal: string
          id?: string
          stato?: Database["public"]["Enums"]["stato_piano"]
          versione?: number
        }
        Update: {
          al?: string
          aggiornato_il?: string
          creato_il?: string
          dal?: string
          id?: string
          stato?: Database["public"]["Enums"]["stato_piano"]
          versione?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          creato_il: string
          id: string
          nome: string | null
          ruolo: Database["public"]["Enums"]["ruolo_utente"]
          worker_id: string | null
        }
        Insert: {
          creato_il?: string
          id: string
          nome?: string | null
          ruolo?: Database["public"]["Enums"]["ruolo_utente"]
          worker_id?: string | null
        }
        Update: {
          creato_il?: string
          id?: string
          nome?: string | null
          ruolo?: Database["public"]["Enums"]["ruolo_utente"]
          worker_id?: string | null
        }
        Relationships: []
      }
      schedules: {
        Row: {
          aggiornato_il: string
          creato_il: string
          id: string
          mese: string
          parametri: Json
          planning_run_id: string
          punteggio: Json | null
          seed: number
          stato: Database["public"]["Enums"]["stato_piano"]
        }
        Insert: {
          aggiornato_il?: string
          creato_il?: string
          id?: string
          mese: string
          parametri?: Json
          planning_run_id: string
          punteggio?: Json | null
          seed?: number
          stato?: Database["public"]["Enums"]["stato_piano"]
        }
        Update: {
          aggiornato_il?: string
          creato_il?: string
          id?: string
          mese?: string
          parametri?: Json
          planning_run_id?: string
          punteggio?: Json | null
          seed?: number
          stato?: Database["public"]["Enums"]["stato_piano"]
        }
        Relationships: []
      }
      settings: {
        Row: {
          aggiornato_il: string
          chiave: string
          valore: Json
        }
        Insert: {
          aggiornato_il?: string
          chiave: string
          valore: Json
        }
        Update: {
          aggiornato_il?: string
          chiave?: string
          valore?: Json
        }
        Relationships: []
      }
      shift_types: {
        Row: {
          attivo: boolean
          codice: string
          colore: string
          conta_nelle_ore: boolean
          creato_il: string
          durata_min: number
          id: string
          is_notte: boolean
          nome: string
          ora_fine: string
          ora_inizio: string
          ordine_rotazione: number | null
          peso_ore: number
          scavalca_mezzanotte: boolean
        }
        Insert: {
          attivo?: boolean
          codice: string
          colore?: string
          conta_nelle_ore?: boolean
          creato_il?: string
          durata_min: number
          id?: string
          is_notte?: boolean
          nome: string
          ora_fine: string
          ora_inizio: string
          ordine_rotazione?: number | null
          peso_ore?: number
          scavalca_mezzanotte?: boolean
        }
        Update: {
          attivo?: boolean
          codice?: string
          colore?: string
          conta_nelle_ore?: boolean
          creato_il?: string
          durata_min?: number
          id?: string
          is_notte?: boolean
          nome?: string
          ora_fine?: string
          ora_inizio?: string
          ordine_rotazione?: number | null
          peso_ore?: number
          scavalca_mezzanotte?: boolean
        }
        Relationships: []
      }
      violations: {
        Row: {
          data: string | null
          gravita: Database["public"]["Enums"]["gravita_violazione"]
          id: string
          messaggio: string
          riferimenti: Json
          schedule_id: string
          tipo: string
          worker_id: string | null
        }
        Insert: {
          data?: string | null
          gravita?: Database["public"]["Enums"]["gravita_violazione"]
          id?: string
          messaggio: string
          riferimenti?: Json
          schedule_id: string
          tipo: string
          worker_id?: string | null
        }
        Update: {
          data?: string | null
          gravita?: Database["public"]["Enums"]["gravita_violazione"]
          id?: string
          messaggio?: string
          riferimenti?: Json
          schedule_id?: string
          tipo?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      worker_positions: {
        Row: {
          livello: number
          position_id: string
          worker_id: string
        }
        Insert: {
          livello?: number
          position_id: string
          worker_id: string
        }
        Update: {
          livello?: number
          position_id?: string
          worker_id?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          attivo: boolean
          cognome: string
          creato_il: string
          email: string | null
          id: string
          matricola: string | null
          max_giorni_consecutivi: number
          nome: string
          note: string | null
          ore_settimanali: number
          percentuale_part_time: number
          riposo_min_dopo_notte_h: number
        }
        Insert: {
          attivo?: boolean
          cognome: string
          creato_il?: string
          email?: string | null
          id?: string
          matricola?: string | null
          max_giorni_consecutivi?: number
          nome: string
          note?: string | null
          ore_settimanali?: number
          percentuale_part_time?: number
          riposo_min_dopo_notte_h?: number
        }
        Update: {
          attivo?: boolean
          cognome?: string
          creato_il?: string
          email?: string | null
          id?: string
          matricola?: string | null
          max_giorni_consecutivi?: number
          nome?: string
          note?: string | null
          ore_settimanali?: number
          percentuale_part_time?: number
          riposo_min_dopo_notte_h?: number
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      applica_riduzione_ore: {
        Args: { p_planning_run_id: string; p_precondizioni: Json; p_versione: number }
        Returns: number
      }
      salva_piano_intervallo: {
        Args: {
          p_al: string
          p_assegnazioni: Json
          p_dal: string
          p_parametri: Json
          p_punteggio: Json
          p_seme: number
          p_violazioni: Json
        }
        Returns: Json
      }
      salva_modifiche_intervallo: {
        Args: {
          p_modifiche: Json
          p_planning_run_id: string
          p_precondizioni: Json
          p_versione: number
        }
        Returns: number
      }
      // Aggiunta a mano in attesa che 20260802000001_newsletter.sql venga
      // applicata: alla prossima rigenerazione ricomparirà identica.
      iscrivi_newsletter: { Args: { p_email: string }; Returns: undefined }
      e_pianificatore: { Args: never; Returns: boolean }
      ruolo_corrente: {
        Args: never
        Returns: Database["public"]["Enums"]["ruolo_utente"]
      }
      worker_corrente: { Args: never; Returns: string }
    }
    Enums: {
      gravita_violazione: "bloccante" | "avviso" | "info"
      origine_assegnazione: "solver" | "manuale"
      origine_vincolo: "manuale" | "ai"
      ruolo_utente: "admin" | "pianificatore" | "lavoratore"
      stato_piano: "bozza" | "pubblicato" | "archiviato"
      tipo_assenza:
        | "ferie"
        | "malattia"
        | "disciplinare"
        | "studio"
        | "permesso"
        | "l104"
        | "formazione"
        | "altro"
      tipo_giorno: "feriale" | "festivo"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T]
