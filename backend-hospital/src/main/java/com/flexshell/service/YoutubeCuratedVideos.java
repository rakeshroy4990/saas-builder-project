package com.flexshell.service;

import java.util.List;

/**
 * Curated hero videos used by the hospital homepage.
 * Add new rows here to expand the random rotation list.
 */
public final class YoutubeCuratedVideos {
    private YoutubeCuratedVideos() {
    }

    public record VideoMeta(String videoId, String title, String description) {
    }

    public static final List<VideoMeta> ALL = List.of(
            new VideoMeta("69JQjti4kX8", "Solids start karte hi baby ko kabz? Normal hai ya tension? #constipation #babyconstipation",
                    "Constipation after starting solids: what is normal and when to worry."),
            new VideoMeta("nzHA7t6konk", "Baby Ear Piercing: Sahi Age, Safe Methods aur Complete Care Guide #babyearpiercing #earpiercing",
                    "Safe age, methods, and after-care tips for infant ear piercing."),
            new VideoMeta("K-06zz8ZpVM", "MMR वैक्सीन Se Autism Hota Hai? Myth Busted | माता-पिता जरूर देखें #mmrvaccine #vaccination #vaccine",
                    "MMR vaccine myths busted with clear parent guidance."),
            new VideoMeta("styXU50Jgao", "Baby Drooling 😰? Baby Ka Muh Se Paani Girna Normal Hai? Kab Doctor Ko Dikhayein? #drooling #baby",
                    "Drooling in babies: normal phases and warning signs."),
            new VideoMeta("HGUh4uX8fe0", "Nebulizer vs Inhaler: Kya Sach Mein Nebulizer Better Hai? Myth Busted! #nebulizer #inhaler #babycare",
                    "Nebulizer vs inhaler: choosing the right approach."),
            new VideoMeta("mXOXZVwvmDw", "Cradle Cap Myths Busted – Force Se Nahi, Care Se Theek Hoga! Cradle Cap vs Eczema Explained!",
                    "Cradle cap vs eczema and practical care tips."),
            new VideoMeta("pa8Z1ywngOg", "Colic Pain Ka Simple Rule - Baby Ke Rona Ka Sach Jaano. Yeh temporary phase hai",
                    "Colic crying patterns and reassurance for parents."),
            new VideoMeta("GJNtnDpT3Jw", "Sarkari aur Private Vaccinations Confused Hain? Vaccinations Samjho, Bacchon ka Future Banao!",
                    "Public vs private vaccination basics for informed choices."),
            new VideoMeta("JtYTqIjr1Vo", "Baby Ki Khansi — Normal Hai Ya Danger Sign? 🤔 Har Maa-Baap Ko Pata Hona Chahiye!",
                    "Cough red flags in children every parent should know."),
            new VideoMeta("1Q5iiO1C_5w", "Baby Snoring ≠ Cold | Ye Myth Ab Bust Ho Gaya 🚫🤧",
                    "Snoring myths in babies and when to seek care."),
            new VideoMeta("4gUm5C0ub78", "Ants Near Baby’s Urine? Does It Really Mean Diabetes? | Pediatrician Explains",
                    "Ants near urine and diabetes myth explained by pediatrician."),
            new VideoMeta("jCaoRJ2tfi0", "Menstruation -- Is it a taboo?? | It Matters to everyone everywhere | Basic Human Rights |",
                    "Menstruation awareness, dignity, and public health."),
            new VideoMeta("eRJcbLnU3_0", "Puberty - Understand body changes in your kids | वयस्क | Raising Kids | Dr Swati Pandey |",
                    "Puberty changes in children and parent communication."),
            new VideoMeta("HlSAFR_YF7o", "If you think you are too small to make a difference, try sleeping with a Mosquito \"The Mass Killer\"",
                    "Mosquito-borne disease awareness and prevention."),
            new VideoMeta("sGIZqQ4rMSk", "Diarrhea dries you out - Understand cause of Diarrhea as prevention is better than cure.",
                    "Diarrhea causes, dehydration risk, and prevention."),
            new VideoMeta("Ia-jxhmIMIQ", "Giving a small, wiggly baby proper hygiene setup is need of the hour #newborn #jaundice #breastmilk",
                    "Newborn hygiene essentials for safer daily care.")
    );
}
