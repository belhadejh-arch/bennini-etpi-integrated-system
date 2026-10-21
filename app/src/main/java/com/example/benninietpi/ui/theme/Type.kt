package com.example.benninietpi.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import com.example.benninietpi.R

private val Changa = FontFamily(Font(R.font.changa))
private val BaseTypography = Typography()
val Typography = BaseTypography.run {
    copy(
        displayLarge = displayLarge.copy(fontFamily = Changa),
        displayMedium = displayMedium.copy(fontFamily = Changa),
        displaySmall = displaySmall.copy(fontFamily = Changa),
        headlineLarge = headlineLarge.copy(fontFamily = Changa),
        headlineMedium = headlineMedium.copy(fontFamily = Changa),
        headlineSmall = headlineSmall.copy(fontFamily = Changa),
        titleLarge = titleLarge.copy(fontFamily = Changa),
        titleMedium = titleMedium.copy(fontFamily = Changa),
        titleSmall = titleSmall.copy(fontFamily = Changa),
        bodyLarge = bodyLarge.copy(fontFamily = Changa),
        bodyMedium = bodyMedium.copy(fontFamily = Changa),
        bodySmall = bodySmall.copy(fontFamily = Changa),
        labelLarge = labelLarge.copy(fontFamily = Changa),
        labelMedium = labelMedium.copy(fontFamily = Changa),
        labelSmall = labelSmall.copy(fontFamily = Changa),
    )
}
